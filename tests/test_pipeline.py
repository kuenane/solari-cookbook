"""
Unit test suite for pipeline.py.

Covered:
  - Defensive JSON parsing (_parse_json_response) across clean strings, markdown fences,
    conversational preambles, malformed payloads, empty strings, and trailing junk (greedy regex).
  - Grounding score calculation (calculate_grounding_score) across empty inputs, full coverage,
    partial coverage, short-clause length penalties (<15 words), and regulation term mismatch fallback.
  - Conditional graph routing (route_after_match) across high scores, low scores under retry limit,
    and maxed-out retries, asserting in-place retry_count mutations.
  - Scoring and verdict assignment (score) across BASELINE_MET, GAPS_FLAGGED, and CONFLICT_OR_ABSENT,
    with dynamic verification against AUTO_FLAG_STATUSES.
  - NIM call fixture loading and network short-circuits (_nim_call) for fixture hit, fixture miss,
    and missing API key conditions.
  - PII sanitization integration (sanitize_pii inside corrective_match) ensuring email masking
    propagates to sanitized_contract_text without network I/O.

Deliberately Not Covered:
  - Full end-to-end graph compilation and execution (audit_contract / _run_clause), which are
    tested separately in integration/LLM suites.
  - Real network API calls to NVIDIA NIM endpoints (live network is disabled and blocked).
  - Production ledger file persistence (desktop.write_audit_log is mocked).
  - Live regulatory scraping via StatutorySourceProvider._try_live_fetch.
"""
from __future__ import annotations

import json
import os
import sys
from unittest.mock import AsyncMock, MagicMock

import pytest

# Ensure repository root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pipeline
from coverage import CoverageEntry, MandatoryTerm, StatuteText
from pipeline import (
    _init_state,
    _nim_call,
    _parse_json_response,
    calculate_grounding_score,
    corrective_match,
    route_after_match,
    score,
)
from state import (
    AUTO_FLAG_STATUSES,
    ClauseState,
    CoverageStatus,
    ReviewStatus,
)

# Enable fixture mode so subsequent test modules (e.g., test_pipeline_llm.py)
# that assume offline fixture playback continue to function when full test suite runs.
pipeline._FIXTURE_MODE = True


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def fake_coverage_entry() -> CoverageEntry:
    """Constructs a deterministic, in-memory CoverageEntry without loading YAML."""
    return CoverageEntry(
        jurisdiction="US",
        topic="data_privacy",
        tier="P0",
        statute_id="ftc-safeguards-16-cfr-314",
        law_code="16 CFR § 314",
        source_url="https://www.ftc.gov/legal-library/browse/rules/safeguards-rule",
        mandatory_terms=[
            MandatoryTerm(term="encryption", provision="16 CFR § 314.4(c)(4)", verified=True),
            MandatoryTerm(term="multi-factor authentication", provision="16 CFR § 314.4(c)(5)", verified=True),
            MandatoryTerm(term="safeguards", provision="16 CFR § 314.4(a)", verified=False),
        ],
        note="Synthetic test coverage entry",
    )


@pytest.fixture
def fake_state(fake_coverage_entry: CoverageEntry) -> ClauseState:
    """Constructs a standard ClauseState dictionary for unit testing."""
    clause = {
        "id": "clause-test-001",
        "number": "§ 1.1",
        "title": "Information Security & Safeguards",
        "topic": "data_privacy",
        "jurisdiction": "US",
        "text": (
            "The vendor agrees to implement encryption and reasonable administrative safeguards "
            "across all systems storing customer personal data."
        ),
        "lines": "Section 1.1",
        "source_doc_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "extraction_method": "plain_text",
        "sanitized_text": (
            "The vendor agrees to implement encryption and reasonable administrative safeguards "
            "across all systems storing customer personal data."
        ),
    }
    state = _init_state("contract-test-uuid", clause)
    state["coverage_tier"] = fake_coverage_entry.tier
    state["regulation_text"] = (
        "16 CFR 314.4: Standards for safeguarding customer information, including encryption, "
        "multi-factor authentication, and risk assessments."
    )
    state["statute_retrieved_at"] = "2026-01-15T12:00:00Z"
    state["match_result"] = {
        "matched": True,
        "calibrated_score": 0.85,
        "llm_reviewed": False,
        "llm_confidence": None,
        "statutory_citation": {
            "law_code": fake_coverage_entry.law_code,
            "title": "US Data Privacy Benchmark",
            "text_snippet": "Standards for safeguarding customer information...",
            "source_url": fake_coverage_entry.source_url,
            "statute_retrieved_at": "2026-01-15T12:00:00Z",
            "missing_provisions": [],
        },
        "missing_obligations": [],
        "sanitized_contract_text": clause["sanitized_text"],
    }
    state["reflection"] = {
        "soundness": True,
        "notes": "Clause language covers the mandatory terms checked for this statute.",
        "llm_reviewed": False,
        "ambiguity_penalty": 0.0,
        "jurisdictional_specificity": "US-P0",
    }
    state["status"] = CoverageStatus.BASELINE_MET.value
    state["review_status"] = ReviewStatus.UNREVIEWED.value
    state["retry_count"] = 0
    state["audit_log"] = []
    state["audit_ledger_entry"] = None
    return state


@pytest.fixture
def fake_desktop() -> MagicMock:
    """Mock for pipeline.desktop preventing filesystem writes to audit_ledger.jsonl."""
    desktop_mock = MagicMock()
    desktop_mock.start = AsyncMock(return_value=None)
    desktop_mock.stop = AsyncMock(return_value=None)
    desktop_mock.extract_clauses = AsyncMock(return_value=[])
    desktop_mock.write_audit_log = AsyncMock(
        return_value={
            "contract_id": "test-mock-id",
            "timestamp": "2026-01-01T00:00:00Z",
            "previous_block_hash": "0" * 64,
            "block_hash": "a" * 64,
            "log_entries": [],
            "metadata": {},
        }
    )
    return desktop_mock


@pytest.fixture
def fake_regulator() -> MagicMock:
    """Mock for pipeline.regulator preventing live network calls."""
    regulator_mock = MagicMock()
    regulator_mock.start = AsyncMock(return_value=None)
    regulator_mock.stop = AsyncMock(return_value=None)
    regulator_mock.get_statutory_text = AsyncMock(
        return_value="Verified synthetic statutory text snapshot."
    )
    return regulator_mock


@pytest.fixture(autouse=True)
def patch_pipeline_globals(
    monkeypatch: pytest.MonkeyPatch,
    fake_coverage_entry: CoverageEntry,
    fake_desktop: MagicMock,
    fake_regulator: MagicMock,
) -> None:
    """Globally patch external singletons and configuration loaders across pipeline.py."""
    monkeypatch.setattr(pipeline, "desktop", fake_desktop)
    monkeypatch.setattr(pipeline, "regulator", fake_regulator)

    # Patch coverage accessors to avoid reading disk YAML files
    monkeypatch.setattr(
        pipeline,
        "get_coverage",
        lambda j, t: fake_coverage_entry if (j, t) == (fake_coverage_entry.jurisdiction, fake_coverage_entry.topic) else None,
    )

    fake_statute = StatuteText(
        statute_id=fake_coverage_entry.statute_id,
        text="Verified synthetic statutory text snapshot.",
        retrieved_at="2026-01-15T12:00:00Z",
    )
    monkeypatch.setattr(
        pipeline,
        "get_statute_text",
        lambda sid: fake_statute if sid == fake_coverage_entry.statute_id else None,
    )


# ============================================================================
# (a) TestParseJsonResponse
# ============================================================================

class TestParseJsonResponse:
    """Tests _parse_json_response across clean, wrapped, malformed, and edge-case strings."""

    def test_clean_json_string(self) -> None:
        raw = '{"matched": true, "confidence": 0.92, "missing_obligations": []}'
        result = _parse_json_response(raw)
        assert result == {"matched": True, "confidence": 0.92, "missing_obligations": []}

    def test_backtick_wrapped_json(self) -> None:
        raw = (
            "```json\n"
            "{\n"
            '  "matched": true,\n'
            '  "confidence": 0.85,\n'
            '  "missing_obligations": ["multi-factor authentication"]\n'
            "}\n"
            "```"
        )
        result = _parse_json_response(raw)
        assert result == {
            "matched": True,
            "confidence": 0.85,
            "missing_obligations": ["multi-factor authentication"],
        }

    def test_json_with_conversational_preamble(self) -> None:
        raw = (
            "Based on my analysis of the contract clause and the FTC Safeguards Rule, "
            "here is the evaluation:\n\n"
            '{"sound": false, "notes": "Missing pinpoint citation for MFA."}'
        )
        result = _parse_json_response(raw)
        assert result == {"sound": False, "notes": "Missing pinpoint citation for MFA."}

    def test_malformed_non_json_input(self) -> None:
        assert _parse_json_response('{"broken_json": "missing closing quote}') == {}
        assert _parse_json_response("This is conversational text without any JSON braces.") == {}
        assert _parse_json_response("{not: valid, json: syntax}") == {}

    def test_empty_string(self) -> None:
        assert _parse_json_response("") == {}

    def test_json_with_trailing_junk_greedy_regex(self) -> None:
        """
        Documents greedy regex behaviour: r"\\{.*\\}" spans from the first '{' to the last '}'.
        - When trailing text has NO braces, the last '}' belongs to the JSON object, so json.loads parses it.
        - When trailing text CONTAINS an extra '}', the greedy match captures past the closing brace,
          producing invalid JSON which triggers json.JSONDecodeError and returns {}.
        """
        # Case 1: Trailing commentary without braces -> parses cleanly
        raw_trailing_text = '{"status": "ok", "confidence": 0.99} Note: reviewed by auditor.'
        assert _parse_json_response(raw_trailing_text) == {"status": "ok", "confidence": 0.99}

        # Case 2: Trailing commentary containing a brace -> greedy match breaks JSON syntax -> returns {}
        raw_trailing_with_brace = '{"status": "ok"} Extra notes with stray closing brace: }'
        assert _parse_json_response(raw_trailing_with_brace) == {}


# ============================================================================
# (b) TestCalculateGroundingScore
# ============================================================================

class TestCalculateGroundingScore:
    """Tests calculate_grounding_score for keyword coverage, penalties, and fallbacks."""

    def test_empty_inputs_return_zero_and_mandatory_terms(self) -> None:
        terms = ["encryption", "safeguards"]

        # Empty clause_text
        score_1, missing_1 = calculate_grounding_score("", "regulation text", terms)
        assert score_1 == 0.0
        assert missing_1 == terms

        # Empty regulation_text
        score_2, missing_2 = calculate_grounding_score("clause text", "", terms)
        assert score_2 == 0.0
        assert missing_2 == terms

        # Empty mandatory_terms
        score_3, missing_3 = calculate_grounding_score("clause text", "regulation text", [])
        assert score_3 == 0.0
        assert missing_3 == []

    def test_full_term_coverage(self) -> None:
        clause = (
            "The vendor shall implement encryption and administrative safeguards "
            "across all database instances to protect sensitive records from compromise."
        )
        reg = "Applicable rules require encryption and administrative safeguards."
        terms = ["encryption", "safeguards"]

        score, missing = calculate_grounding_score(clause, reg, terms)
        # Term coverage is 1.0, length is >= 15 words (no penalty), capped at min(0.98, 1.0)
        assert score == 0.98
        assert missing == []

    def test_partial_term_coverage(self) -> None:
        clause = (
            "The vendor shall implement encryption across all database instances "
            "to protect sensitive records from compromise and unauthorized access."
        )
        reg = "Applicable rules require encryption and safeguards."
        terms = ["encryption", "safeguards"]

        score, missing = calculate_grounding_score(clause, reg, terms)
        # 1 of 2 terms matched (0.5), length is >= 15 words (no penalty)
        assert score == 0.5
        assert missing == ["safeguards"]

    def test_short_clause_triggers_length_penalty(self) -> None:
        short_clause = "Vendor implements encryption and safeguards."  # 5 words (<15)
        long_clause = (
            "Vendor implements encryption and safeguards across all production systems "
            "to protect customer personal information from unauthorized access."
        )  # 17 words (>=15)
        reg = "Mandatory obligations include encryption and safeguards."
        terms = ["encryption", "safeguards"]

        short_score, short_missing = calculate_grounding_score(short_clause, reg, terms)
        long_score, long_missing = calculate_grounding_score(long_clause, reg, terms)

        assert short_missing == []
        assert long_missing == []
        # Short clause suffers 0.1 penalty: 1.0 - 0.1 = 0.90 vs min(0.98, 1.0) = 0.98
        assert short_score == 0.9
        assert long_score == 0.98

    def test_relevant_terms_fallback_when_regulation_contains_no_mandatory_terms(self) -> None:
        # None of the mandatory_terms exist in reg_text, triggering fallback: relevant_terms = mandatory_terms
        reg = "General governance standards without naming specific technical controls."
        clause = (
            "Vendor mandates encryption across all customer repositories to protect "
            "stored corporate and personal data from exposure."
        )  # 16 words (>=15)
        terms = ["encryption", "safeguards"]

        score, missing = calculate_grounding_score(clause, reg, terms)
        # Fallback uses all mandatory terms; 'encryption' found (1/2 = 0.5), 'safeguards' missing
        assert score == 0.5
        assert missing == ["safeguards"]


# ============================================================================
# (c) TestRouteAfterMatch
# ============================================================================

class TestRouteAfterMatch:
    """Tests route_after_match routing branches and in-place retry_count mutations."""

    def test_score_gte_60_routes_to_reflect_retry_count_unchanged(self, fake_state: ClauseState) -> None:
        fake_state["match_result"]["calibrated_score"] = 0.65
        fake_state["retry_count"] = 0

        destination = route_after_match(fake_state)
        assert destination == "reflect"
        assert fake_state["retry_count"] == 0

        # Boundary condition: exactly 0.60
        fake_state["match_result"]["calibrated_score"] = 0.60
        fake_state["retry_count"] = 1

        destination_boundary = route_after_match(fake_state)
        assert destination_boundary == "reflect"
        assert fake_state["retry_count"] == 1

    def test_score_lt_60_retry_lt_2_routes_to_retrieve_and_increments_retry_count(
        self, fake_state: ClauseState
    ) -> None:
        fake_state["match_result"]["calibrated_score"] = 0.55
        fake_state["retry_count"] = 0

        destination = route_after_match(fake_state)
        assert destination == "retrieve_regulations"
        assert fake_state["retry_count"] == 1

        # Second retry while retry_count < 2
        destination_second = route_after_match(fake_state)
        assert destination_second == "retrieve_regulations"
        assert fake_state["retry_count"] == 2

    def test_score_lt_60_retry_eq_2_routes_to_reflect_retry_count_unchanged(
        self, fake_state: ClauseState
    ) -> None:
        fake_state["match_result"]["calibrated_score"] = 0.40
        fake_state["retry_count"] = 2

        destination = route_after_match(fake_state)
        assert destination == "reflect"
        assert fake_state["retry_count"] == 2


# ============================================================================
# (d) TestScore
# ============================================================================

class TestScore:
    """Tests score() across all CoverageStatus branches and AUTO_FLAG_STATUSES transitions."""

    @pytest.mark.asyncio
    async def test_baseline_met_branch(self, fake_state: ClauseState) -> None:
        fake_state["match_result"]["calibrated_score"] = 0.85
        fake_state["reflection"]["soundness"] = True

        result = await score(fake_state)

        assert result["status"] == CoverageStatus.BASELINE_MET.value
        # Assert dynamically against imported AUTO_FLAG_STATUSES
        expected_review = (
            ReviewStatus.FLAGGED_FOR_COUNSEL.value
            if CoverageStatus.BASELINE_MET in AUTO_FLAG_STATUSES
            else ReviewStatus.UNREVIEWED.value
        )
        assert result["review_status"] == expected_review
        assert CoverageStatus.BASELINE_MET not in AUTO_FLAG_STATUSES

    @pytest.mark.asyncio
    async def test_gaps_flagged_branch_high_score_unsound(self, fake_state: ClauseState) -> None:
        # Score >= 0.80 but soundness is False -> GAPS_FLAGGED
        fake_state["match_result"]["calibrated_score"] = 0.85
        fake_state["reflection"]["soundness"] = False

        result = await score(fake_state)

        assert result["status"] == CoverageStatus.GAPS_FLAGGED.value
        expected_review = (
            ReviewStatus.FLAGGED_FOR_COUNSEL.value
            if CoverageStatus.GAPS_FLAGGED in AUTO_FLAG_STATUSES
            else ReviewStatus.UNREVIEWED.value
        )
        assert result["review_status"] == expected_review
        assert CoverageStatus.GAPS_FLAGGED in AUTO_FLAG_STATUSES

    @pytest.mark.asyncio
    async def test_gaps_flagged_branch_mid_score_sound(self, fake_state: ClauseState) -> None:
        # Score in [0.45, 0.80) -> GAPS_FLAGGED regardless of soundness
        fake_state["match_result"]["calibrated_score"] = 0.60
        fake_state["reflection"]["soundness"] = True

        result = await score(fake_state)

        assert result["status"] == CoverageStatus.GAPS_FLAGGED.value
        expected_review = (
            ReviewStatus.FLAGGED_FOR_COUNSEL.value
            if CoverageStatus.GAPS_FLAGGED in AUTO_FLAG_STATUSES
            else ReviewStatus.UNREVIEWED.value
        )
        assert result["review_status"] == expected_review

    @pytest.mark.asyncio
    async def test_conflict_or_absent_branch(self, fake_state: ClauseState) -> None:
        # Score < 0.45 -> CONFLICT_OR_ABSENT
        fake_state["match_result"]["calibrated_score"] = 0.30
        fake_state["reflection"]["soundness"] = False

        result = await score(fake_state)

        assert result["status"] == CoverageStatus.CONFLICT_OR_ABSENT.value
        expected_review = (
            ReviewStatus.FLAGGED_FOR_COUNSEL.value
            if CoverageStatus.CONFLICT_OR_ABSENT in AUTO_FLAG_STATUSES
            else ReviewStatus.UNREVIEWED.value
        )
        assert result["review_status"] == expected_review
        assert CoverageStatus.CONFLICT_OR_ABSENT in AUTO_FLAG_STATUSES


# ============================================================================
# (e) TestNimCall
# ============================================================================

class TestNimCall:
    """Tests _nim_call fixture replaying and network short-circuit execution."""

    @pytest.mark.asyncio
    async def test_fixture_mode_with_existing_fixture(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: pytest.TempPathFactory
    ) -> None:
        fixture_payload = {
            "matched": True,
            "confidence": 0.88,
            "missing_obligations": ["multi-factor authentication"],
            "notes": "Verified against FTC Safeguards.",
        }
        fixture_file = tmp_path / "match_synthetic_fixture.json"
        fixture_file.write_text(json.dumps(fixture_payload), encoding="utf-8")

        monkeypatch.setattr(pipeline, "_FIXTURE_MODE", True)
        monkeypatch.setattr(pipeline, "_FIXTURES_DIR", str(tmp_path))

        result = await _nim_call("Audit prompt", fixture_name="match_synthetic_fixture")
        assert result == fixture_payload

    @pytest.mark.asyncio
    async def test_fixture_mode_with_missing_fixture(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: pytest.TempPathFactory
    ) -> None:
        monkeypatch.setattr(pipeline, "_FIXTURE_MODE", True)
        monkeypatch.setattr(pipeline, "_FIXTURES_DIR", str(tmp_path))

        result = await _nim_call("Audit prompt", fixture_name="nonexistent_fixture_file")
        assert result == {}

    @pytest.mark.asyncio
    async def test_no_fixture_mode_and_no_api_key_returns_empty_without_network(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(pipeline, "_FIXTURE_MODE", False)
        monkeypatch.delenv("NVIDIA_API_KEY", raising=False)

        # Mock _nim_client to strictly verify no network client is ever instantiated
        client_mock = MagicMock()
        monkeypatch.setattr(pipeline, "_nim_client", client_mock)

        result = await _nim_call("Audit prompt", fixture_name=None)
        assert result == {}
        client_mock.assert_not_called()


# ============================================================================
# (f) TestCorrectiveMatchSanitizePii
# ============================================================================

class TestCorrectiveMatchSanitizePii:
    """Tests PII sanitization integration within corrective_match."""

    @pytest.mark.asyncio
    async def test_sanitize_pii_applied_to_clause_in_corrective_match(
        self, fake_state: ClauseState, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Provide raw clause text containing confidential email addresses
        raw_clause_with_pii = (
            "All security incidents must be reported immediately to compliance@vendorcorp.com "
            "and escalated to dpo-security@safeguard-partner.org."
        )
        fake_state["clause"]["text"] = raw_clause_with_pii

        # Patch _nim_call so no LLM or network call occurs
        mock_nim = AsyncMock(return_value={})
        monkeypatch.setattr(pipeline, "_nim_call", mock_nim)

        result = await corrective_match(fake_state)

        sanitized_output = result["match_result"]["sanitized_contract_text"]
        assert "[REDACTED_EMAIL]" in sanitized_output
        assert "compliance@vendorcorp.com" not in sanitized_output
        assert "dpo-security@safeguard-partner.org" not in sanitized_output

        # Verify structured audit log entry without asserting on human-readable strings
        match_log = next(entry for entry in result["audit_log"] if entry.get("stage") == "match")
        assert match_log["stage"] == "match"
        assert "surface" in match_log
        assert "calibrated_score" in match_log
