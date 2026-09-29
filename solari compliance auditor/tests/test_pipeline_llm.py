"""
Phase 2 regression tests. The original bug: pipeline.py called the NIM
model and then discarded the response entirely (`_ = await _nim_call(...)`),
so the "AI compliance engine" was, in practice, the keyword heuristic
alone. These tests run the real corrective_match/reflect stages with
SOLARI_TEST_FIXTURES=1, replaying recorded JSON fixtures instead of
calling the network, and assert the LLM output actually changes state.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["SOLARI_TEST_FIXTURES"] = "1"

import pytest

from pipeline import corrective_match, reflect, _init_state
from coverage import get_coverage


def _make_ambiguous_state():
    """
    A US data-privacy clause that mentions SOME but not all mandatory
    terms - lands in the ambiguous band so the LLM fixture actually gets
    invoked (see LLM_LOWER_BAND/LLM_UPPER_BAND in pipeline.py).
    """
    entry = get_coverage("US", "data_privacy")
    clause = {
        "id": "clause-001",
        "jurisdiction": "US",
        "topic": "data_privacy",
        "text": "The parties agree to encrypt customer information at rest and implement administrative safeguards.",
    }
    state = _init_state("contract-test", clause)
    state["regulation_text"] = (
        "16 CFR 314.4(e): safeguards, encryption, at rest, in transit, administrative, "
        "technical, physical, breach, notification, authorized, multi-factor authentication."
    )
    state["statute_retrieved_at"] = "2026-06-01"
    return state


def test_llm_response_is_actually_used_not_discarded():
    state = _make_ambiguous_state()
    result = asyncio.run(corrective_match(state))

    assert result["match_result"]["llm_reviewed"] is True, (
        "LLM fixture should have fired for an ambiguous P0 match - if this is False, "
        "the LLM call is being skipped or its result discarded again."
    )
    # The fixture reports 'multi-factor authentication' as missing - that
    # must show up in missing_obligations, proving the parsed response
    # actually reached the output rather than being thrown away.
    assert "multi-factor authentication" in result["match_result"]["missing_obligations"]


def test_reflection_uses_llm_when_match_was_llm_reviewed():
    state = _make_ambiguous_state()
    state = asyncio.run(corrective_match(state))
    state = asyncio.run(reflect(state))

    assert state["reflection"]["llm_reviewed"] is True
    assert state["reflection"]["soundness"] is False  # fixture says sound=false
    assert "MFA" in state["reflection"]["notes"] or "material gap" in state["reflection"]["notes"]


def test_p2_tier_never_calls_llm_even_when_ambiguous():
    """Heuristic-only tiers must not spend a model call, per CoverageEntry.llm_eligible."""
    entry = get_coverage("LS", "employment")
    assert entry.tier == "P2"
    clause = {
        "id": "clause-002", "jurisdiction": "LS", "topic": "employment",
        "text": "Notice period shall be one calendar month.",
    }
    state = _init_state("contract-test", clause)
    state["regulation_text"] = "Lesotho Labour Code: notice period, termination, severance."
    result = asyncio.run(corrective_match(state))
    assert result["match_result"]["llm_reviewed"] is False


def test_citation_comes_from_coverage_matrix_not_hardcoded():
    """
    Regression test for the original bug: the citation used to be a
    hardcoded ternary ('16 CFR 314.4(e)' if US else 'GDPR Article 28(3)')
    applied to every clause regardless of actual topic/statute. It must
    now come from the coverage matrix entry matching the clause's own
    (jurisdiction, topic), including per-term pinpoint provisions.
    """
    state = _make_ambiguous_state()
    result = asyncio.run(corrective_match(state))
    citation = result["match_result"]["statutory_citation"]
    entry = get_coverage("US", "data_privacy")
    assert citation["law_code"] == entry.law_code
    assert citation["source_url"] == entry.source_url

    # The missing MFA obligation should carry its own verified pinpoint
    # citation, not just the top-level law_code repeated.
    mfa_provision = next(
        (p for p in citation["missing_provisions"] if p["term"] == "multi-factor authentication"), None
    )
    assert mfa_provision is not None
    assert mfa_provision["verified"] is True
    assert mfa_provision["provision"] == "16 CFR \u00a7 314.4(c)(5)"
