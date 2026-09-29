"""
Phase 0/2 tests: the original bug was a single global mandatory_terms list
used for every clause regardless of topic, so an employment clause was
scored against data-privacy keywords (safeguards/encryption/breach) and
would structurally undershoot no matter how compliant it actually was.
These tests confirm each (jurisdiction, topic) cell uses its own
vocabulary, and that out-of-scope pairs are never silently scored.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from pipeline import calculate_grounding_score
from coverage import get_coverage, load_coverage_matrix


def test_us_data_privacy_vocabulary_is_privacy_specific():
    entry = get_coverage("US", "data_privacy")
    assert entry is not None
    assert "encryption" in entry.term_strings
    assert "at-will" not in entry.term_strings  # employment term must not leak in


def test_us_employment_vocabulary_is_employment_specific():
    entry = get_coverage("US", "employment")
    assert entry is not None
    assert "at-will" in entry.term_strings
    assert "encryption" not in entry.term_strings  # privacy term must not leak in


def test_employment_clause_scores_reasonably_against_employment_vocabulary():
    """
    Regression test for the original bug: this clause is a clean, complete
    at-will employment clause. Scored against the OLD global privacy
    vocabulary it would score ~0 (no "encryption"/"breach" present).
    Scored against the correct per-topic vocabulary, it should score well.
    """
    entry = get_coverage("US", "employment")
    clause = (
        "Employment under this Agreement is at-will and may be terminated by either "
        "party for any lawful reason. Employee's classification as exempt or "
        "non-exempt will be determined in accordance with minimum wage and overtime "
        "requirements."
    )
    regulation_text = "Fair Labor Standards Act: at-will, overtime, minimum wage, classification (exempt vs non-exempt)."
    score, missing = calculate_grounding_score(clause, regulation_text, entry.term_strings)
    assert score >= 0.5, f"Employment clause scored too low against its own vocabulary: {score}, missing={missing}"


def test_privacy_clause_does_not_get_credit_for_employment_terms():
    entry = get_coverage("US", "data_privacy")
    clause = "Employee classification shall be exempt or non-exempt under applicable wage law."
    regulation_text = "16 CFR 314.4(e): safeguards, encryption, breach notification, MFA."
    score, missing = calculate_grounding_score(clause, regulation_text, entry.term_strings)
    assert score < 0.5, "A clause with zero privacy terms should not score well against the privacy vocabulary"


def test_out_of_scope_pair_returns_none():
    """SADC was explicitly dropped from the coverage matrix; must never silently resolve to a cell."""
    assert get_coverage("SADC", "data_privacy") is None
    assert get_coverage("US", "liability_indemnity") is None
    assert get_coverage("ZZ", "made_up_topic") is None


def test_all_coverage_entries_have_a_valid_tier_and_nonempty_vocabulary():
    matrix = load_coverage_matrix()
    assert len(matrix) > 0
    for (jurisdiction, topic), entry in matrix.items():
        assert entry.tier in ("P0", "P1", "P2"), f"{jurisdiction}/{topic} has invalid tier {entry.tier}"
        assert len(entry.mandatory_terms) > 0, f"{jurisdiction}/{topic} has an empty vocabulary"
        assert entry.law_code, f"{jurisdiction}/{topic} has no law_code"


def test_p2_entries_are_not_llm_eligible():
    """P2 (thin/secondary source) tiers should never spend an LLM call - see CoverageEntry.llm_eligible."""
    entry = get_coverage("LS", "employment")
    assert entry is not None
    assert entry.tier == "P2"
    assert entry.llm_eligible is False


def test_p0_entries_are_llm_eligible():
    entry = get_coverage("US", "data_privacy")
    assert entry.tier == "P0"
    assert entry.llm_eligible is True


def test_verified_citations_have_a_provision_and_unverified_never_fake_one():
    """
    The whole point of the verified flag: a term can only claim a pinpoint
    citation is verified if one is actually present. An unverified term is
    allowed to have a best-guess provision string, but it must not be
    silently promoted to verified=True without one.
    """
    matrix = load_coverage_matrix()
    for (jurisdiction, topic), entry in matrix.items():
        for mt in entry.mandatory_terms:
            if mt.verified:
                assert mt.provision is not None


def test_ftc_safeguards_mfa_citation_matches_primary_source():
    """
    Regression test for a specific, independently-verified citation (see
    config/coverage.yaml comment trail - confirmed against Cornell Law's
    text of 16 CFR 314.4 and the FTC's own guidance page).
    """
    entry = get_coverage("US", "data_privacy")
    mt = entry.provision_for("multi-factor authentication")
    assert mt is not None
    assert mt.verified is True
    assert mt.provision == "16 CFR \u00a7 314.4(c)(5)"


def test_uk_holiday_entitlement_cites_working_time_regulations_not_era():
    """
    Regression test for a real error caught during this pass: holiday
    entitlement is governed by the Working Time Regulations 1998, not the
    Employment Rights Act 1996 (the law_code originally claimed only ERA
    1996). The per-term provision must reflect the correct statute.
    """
    entry = get_coverage("UK", "employment")
    mt = entry.provision_for("holiday entitlement")
    assert mt is not None
    assert "Working Time Regulations" in mt.provision
    assert "ERA" not in mt.provision
