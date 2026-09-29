import asyncio
import json
import os
import re
from typing import List, Optional, Tuple

from langgraph.graph import StateGraph, END
from openai import OpenAI

from state import (
    ClauseState,
    MatchEvaluation,
    ReflectionReport,
    AuditScoreOutput,
    StatutoryCitation,
    CoverageStatus,
    ReviewStatus,
    AUTO_FLAG_STATUSES,
)
from coverage import get_coverage, get_statute_text
from surfaces.desktop import DesktopSurface, sanitize_pii
from surfaces.browser import StatutorySourceProvider

from dotenv import load_dotenv
load_dotenv()

desktop = DesktopSurface()
regulator = StatutorySourceProvider()

NIM_MODEL = "nvidia/nemotron-3-ultra-550b-a55b"
RATE_LIMIT_DELAY = 0.5

# Ambiguity band: below this, the keyword gate alone is confident enough
# (score >= 0.85, clean match) or damning enough (score < 0.45, clear
# conflict) that an LLM call adds cost without changing the verdict. Only
# the ambiguous middle, or any match with missing obligations, is worth a
# model call - and only for P0/P1 sources (see CoverageEntry.llm_eligible).
LLM_LOWER_BAND = 0.45
LLM_UPPER_BAND = 0.85

_FIXTURE_MODE = os.environ.get("SOLARI_TEST_FIXTURES") == "1"
_FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "tests", "fixtures")


def _nim_client() -> OpenAI:
    api_key = os.environ.get("NVIDIA_API_KEY")
    return OpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=api_key or "unset")


def _parse_json_response(raw: str) -> dict:
    """
    Defensive JSON extraction: LLMs frequently wrap JSON in markdown fences
    or add conversational preamble. Pull out the first {...} block; return
    {} on failure so callers can fall back to the deterministic heuristic
    rather than crash.
    """
    if not raw:
        return {}
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return {}
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return {}


async def _nim_call(prompt: str, fixture_name: Optional[str] = None) -> dict:
    """
    Invokes the NIM model and returns a parsed dict. Actually used by
    callers now (previously the response was discarded and the heuristic
    score was the entire "AI" evaluation).

    Test/CI mode: set SOLARI_TEST_FIXTURES=1 and this replays a recorded
    JSON fixture instead of calling the network, so tests are deterministic
    without needing a live NVIDIA_API_KEY.
    """
    if _FIXTURE_MODE and fixture_name:
        fixture_path = os.path.join(_FIXTURES_DIR, f"{fixture_name}.json")
        if os.path.exists(fixture_path):
            with open(fixture_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    if not os.environ.get("NVIDIA_API_KEY"):
        return {}

    await asyncio.sleep(RATE_LIMIT_DELAY)
    try:
        client = _nim_client()
        response = client.chat.completions.create(
            model=NIM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=1024,
        )
        return _parse_json_response(response.choices[0].message.content or "")
    except Exception as e:
        print(f"[NIM Call Error]: {e}")
        return {}


def calculate_grounding_score(clause_text: str, regulation_text: str, mandatory_terms: List[str]) -> Tuple[float, List[str]]:
    """
    Deterministic gate: entity/keyword coverage ratio against the
    per-(jurisdiction, topic) vocabulary defined in config/coverage.yaml
    (not a single global list shared by every topic - a US employment
    clause is no longer scored against data-privacy keywords).
    """
    if not clause_text or not regulation_text or not mandatory_terms:
        return 0.0, list(mandatory_terms)

    reg_lower = regulation_text.lower()
    clause_lower = clause_text.lower()

    relevant_terms = [t for t in mandatory_terms if t in reg_lower] or mandatory_terms
    found_in_clause = [t for t in relevant_terms if t in clause_lower]
    missing_in_clause = [t for t in relevant_terms if t not in clause_lower]

    term_coverage = len(found_in_clause) / max(len(relevant_terms), 1)
    length_penalty = 0.1 if len(clause_text.split()) < 15 else 0.0

    calibrated_score = max(0.1, min(0.98, term_coverage - length_penalty))
    return round(calibrated_score, 3), missing_in_clause


async def retrieve_regulations(state: ClauseState) -> ClauseState:
    """Stage 1: pulls the verified, dated statutory snapshot for this coverage cell."""
    entry = get_coverage(state["jurisdiction"], state["topic"])
    if entry is None:
        state["regulation_text"] = ""
        state["statute_retrieved_at"] = None
        return state

    statute = get_statute_text(entry.statute_id)
    try:
        state["regulation_text"] = await regulator.get_statutory_text(entry, statute)
    except Exception as e:
        state["regulation_text"] = statute.text if statute else f"[source fetch failed: {e}]"

    state["statute_retrieved_at"] = statute.retrieved_at if statute else None
    state["audit_log"].append({
        "stage": "retrieve",
        "surface": "statutory-source",
        "jurisdiction": state["jurisdiction"],
        "topic": state["topic"],
        "tier": entry.tier,
        "law_code": entry.law_code,
        "url": entry.source_url,
        "statute_retrieved_at": state["statute_retrieved_at"],
        "chars_retrieved": len(state["regulation_text"]),
    })
    return state


async def corrective_match(state: ClauseState) -> ClauseState:
    """
    Stage 2: keyword gate first (cheap, deterministic), then an LLM call
    ONLY for ambiguous matches on P0/P1 sources - and the LLM's output is
    now actually used, not discarded.
    """
    entry = get_coverage(state["jurisdiction"], state["topic"])
    raw_clause = state["clause"].get("text", "")
    sanitized_clause = sanitize_pii(raw_clause)
    reg_text = state.get("regulation_text", "")

    gate_score, missing = calculate_grounding_score(sanitized_clause, reg_text, entry.term_strings)

    llm_reviewed = False
    llm_confidence = None
    calibrated_score = gate_score

    ambiguous = LLM_LOWER_BAND <= gate_score < LLM_UPPER_BAND or bool(missing)
    if ambiguous and entry.llm_eligible:
        prompt = (
            "You are a statutory compliance auditor. Evaluate the sanitized contract "
            "clause against the regulatory standard below and respond with ONLY a JSON "
            "object: {\"matched\": bool, \"confidence\": float 0-1, \"missing_obligations\": "
            "[string], \"notes\": string}.\n\n"
            f"Statute: {entry.law_code}\n"
            f"Regulatory Standard: {reg_text}\n"
            f"Contract Clause: {sanitized_clause}\n"
        )
        result = await _nim_call(prompt, fixture_name=f"match_{entry.statute_id}")
        if result:
            llm_reviewed = True
            llm_confidence = float(result.get("confidence", gate_score))
            # Blend: keyword gate stays the floor, LLM confidence can only
            # move the score within the ambiguous band it was called for -
            # a single hallucinated 0.99 shouldn't override an absent
            # statutory term outright.
            calibrated_score = round(max(gate_score, min(llm_confidence, LLM_UPPER_BAND + 0.13)), 3)
            llm_missing = result.get("missing_obligations")
            if isinstance(llm_missing, list) and llm_missing:
                missing = sorted(set(missing) | {str(m) for m in llm_missing})

    match_eval = MatchEvaluation(
        matched=True,
        calibrated_score=calibrated_score,
        llm_reviewed=llm_reviewed,
        llm_confidence=llm_confidence,
        statutory_citation=StatutoryCitation(
            law_code=entry.law_code,
            title=f"{entry.jurisdiction} {entry.topic.replace('_', ' ').title()} Benchmark",
            text_snippet=reg_text[:200] + ("..." if len(reg_text) > 200 else ""),
            source_url=entry.source_url,
            statute_retrieved_at=state.get("statute_retrieved_at") or "unknown",
            missing_provisions=[
                {
                    "term": term,
                    "provision": (mt.provision if mt else None),
                    "verified": (mt.verified if mt else False),
                    "note": (mt.note if mt else "Term not found in coverage matrix vocabulary (LLM-surfaced)."),
                }
                for term in missing
                for mt in [entry.provision_for(term)]
            ],
        ),
        missing_obligations=missing,
        sanitized_contract_text=sanitized_clause,
    )

    state["match_result"] = match_eval.model_dump()
    state["audit_log"].append({
        "stage": "match",
        "surface": "llm" if llm_reviewed else "heuristic-gate",
        "calibrated_score": match_eval.calibrated_score,
        "llm_reviewed": llm_reviewed,
        "missing_obligations_count": len(missing),
        "citation": match_eval.statutory_citation.law_code,
    })
    return state


def route_after_match(state: ClauseState) -> str:
    score = state["match_result"].get("calibrated_score", 0.0)
    if score < 0.60 and state["retry_count"] < 2:
        state["retry_count"] += 1
        return "retrieve_regulations"
    return "reflect"


async def reflect(state: ClauseState) -> ClauseState:
    """Stage 3: LLM-backed critique when the match was LLM-reviewed; heuristic notes otherwise."""
    entry = get_coverage(state["jurisdiction"], state["topic"])
    missing = state["match_result"].get("missing_obligations", [])
    has_defects = len(missing) > 0 or state["match_result"].get("calibrated_score", 0.0) < 0.75
    llm_reviewed = False
    notes = None

    if state["match_result"].get("llm_reviewed") and entry.llm_eligible:
        prompt = (
            "You previously matched this contract clause against a statutory standard. "
            f"Missing obligations flagged: {missing}. Statute: {entry.law_code}.\n"
            "Respond with ONLY JSON: {\"sound\": bool, \"notes\": string (1-2 sentences)}."
        )
        result = await _nim_call(prompt, fixture_name=f"reflect_{entry.statute_id}")
        if result:
            llm_reviewed = True
            has_defects = not bool(result.get("sound", not has_defects))
            notes = result.get("notes")

    if not notes:
        notes = (
            f"Clause omits terms expected under {entry.law_code}: {', '.join(missing[:4]) or 'none named'}."
            if has_defects else
            "Clause language covers the mandatory terms checked for this statute."
        )

    reflection = ReflectionReport(
        soundness=not has_defects,
        notes=notes,
        llm_reviewed=llm_reviewed,
        ambiguity_penalty=0.20 if has_defects else 0.0,
        jurisdictional_specificity=f"{entry.jurisdiction}-{entry.tier}",
    )

    state["reflection"] = reflection.model_dump()
    state["audit_log"].append({
        "stage": "reflect",
        "surface": "llm" if llm_reviewed else "heuristic-template",
        "soundness": reflection.soundness,
        "ambiguity_penalty": reflection.ambiguity_penalty,
    })
    return state


async def score(state: ClauseState) -> ClauseState:
    """Stage 4: maps to CoverageStatus (not a compliance verdict) + a review-queue transition."""
    calibrated = state["match_result"].get("calibrated_score", 0.0)
    soundness = state["reflection"].get("soundness", False)

    if calibrated >= 0.80 and soundness:
        status = CoverageStatus.BASELINE_MET
    elif calibrated >= 0.45:
        status = CoverageStatus.GAPS_FLAGGED
    else:
        status = CoverageStatus.CONFLICT_OR_ABSENT

    review_status = (
        ReviewStatus.FLAGGED_FOR_COUNSEL if status in AUTO_FLAG_STATUSES else ReviewStatus.UNREVIEWED
    )

    missing_provisions = state["match_result"].get("statutory_citation", {}).get("missing_provisions", [])
    if missing_provisions:
        cites = []
        for mp in missing_provisions[:3]:
            if mp.get("provision"):
                marker = "" if mp.get("verified") else " (unverified pinpoint)"
                cites.append(f"{mp['term']} [{mp['provision']}{marker}]")
            else:
                cites.append(f"{mp['term']} [no pinpoint citation on file - see law_code]")
        amendment = f"Add language covering: {'; '.join(cites)}."
    else:
        amendment = "No amendment recommended by this pass."

    score_out = AuditScoreOutput(
        status=status,
        rationale=(
            f"Keyword/LLM-blended coverage against statute: {calibrated:.2f}. "
            f"Reflection soundness: {soundness}. This reflects term-matching, not a legal opinion."
        ),
        review_status=review_status,
        recommended_amendment=(amendment if status != CoverageStatus.BASELINE_MET else "No amendment recommended by this pass."),
    )

    state["status"] = score_out.status.value
    state["review_status"] = score_out.review_status.value
    state["audit_log"].append({
        "stage": "score",
        "surface": "sandbox",
        "status": state["status"],
        "review_status": state["review_status"],
        "recommended_amendment": score_out.recommended_amendment,
    })
    return state


async def log(state: ClauseState) -> ClauseState:
    """Stage 5: commits the SHA-256 hash-chained block. Single writer (see surfaces/desktop.py)."""
    entry = await desktop.write_audit_log(
        contract_id=state["contract_id"],
        log_entries=state["audit_log"],
        metadata={
            "clause_id": state["clause"].get("id"),
            "status": state["status"],
            "review_status": state["review_status"],
            "calibrated_score": state["match_result"].get("calibrated_score"),
            "model": NIM_MODEL,
        },
    )
    state["audit_ledger_entry"] = entry
    return state


graph = StateGraph(ClauseState)
for name, fn in [
    ("retrieve_regulations", retrieve_regulations),
    ("corrective_match", corrective_match),
    ("reflect", reflect),
    ("score", score),
    ("log", log),
]:
    graph.add_node(name, fn)

graph.set_entry_point("retrieve_regulations")
graph.add_edge("retrieve_regulations", "corrective_match")
graph.add_conditional_edges(
    "corrective_match",
    route_after_match,
    {"retrieve_regulations": "retrieve_regulations", "reflect": "reflect"},
)
graph.add_edge("reflect", "score")
graph.add_edge("score", "log")
graph.add_edge("log", END)

app = graph.compile()


def _init_state(contract_id: str, clause: dict) -> ClauseState:
    jurisdiction = clause.get("jurisdiction", "US")
    topic = clause.get("topic", "out_of_scope")
    return {
        "contract_id": contract_id,
        "clause": clause,
        "jurisdiction": jurisdiction,
        "topic": topic,
        "coverage_tier": None,
        "regulation_text": "",
        "statute_retrieved_at": None,
        "match_result": {},
        "reflection": {},
        "status": CoverageStatus.OUT_OF_SCOPE.value,
        "review_status": ReviewStatus.UNREVIEWED.value,
        "retry_count": 0,
        "audit_log": [],
        "audit_ledger_entry": None,
    }


async def _run_clause(contract_id: str, clause: dict) -> ClauseState:
    initial = _init_state(contract_id, clause)
    entry = get_coverage(initial["jurisdiction"], initial["topic"])

    if entry is None:
        # Out of scope: never silently defaults into a data_privacy score.
        initial["audit_log"].append({
            "stage": "scope_check",
            "surface": "coverage-matrix",
            "message": (
                f"({initial['jurisdiction']}, {initial['topic']}) is not in the coverage "
                "matrix - clause extracted but not scored."
            ),
        })
        initial["audit_ledger_entry"] = await desktop.write_audit_log(
            contract_id=contract_id,
            log_entries=initial["audit_log"],
            metadata={"clause_id": clause.get("id"), "status": "out_of_scope"},
        )
        return initial

    initial["coverage_tier"] = entry.tier
    return await app.ainvoke(initial)


async def audit_contract(pdf_path: str, contract_id: str) -> list[ClauseState]:
    await desktop.start()
    await regulator.start()
    try:
        clauses = await desktop.extract_clauses(pdf_path)
        return [await _run_clause(contract_id, clause) for clause in clauses]
    finally:
        await desktop.stop()
        await regulator.stop()
