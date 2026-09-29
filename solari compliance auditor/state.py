"""
Central data model for the audit pipeline.

Phase 0 rename: the old Literal["red", "amber", "green"] verdict read to a
non-technical reviewer as a compliance certification ("green = compliant").
CoverageStatus replaces it with vocabulary that can only mean what the tool
actually does: term-matching against a named statute, not a legal opinion.
"""
from enum import Enum
from typing import TypedDict, Optional, List, Dict, Any

from pydantic import BaseModel, Field


class CoverageStatus(str, Enum):
    BASELINE_MET = "baseline_met"           # was "green" / "VERIFIED"
    GAPS_FLAGGED = "gaps_flagged"           # was "amber"
    CONFLICT_OR_ABSENT = "conflict_or_absent"  # was "red" / "REJECTED"
    OUT_OF_SCOPE = "out_of_scope"           # new: not a verdict, a routing state


class ReviewStatus(str, Enum):
    UNREVIEWED = "unreviewed"
    FLAGGED_FOR_COUNSEL = "flagged_for_counsel"
    COUNSEL_APPROVED = "counsel_approved"
    COUNSEL_REJECTED = "counsel_rejected"


# Verdicts that auto-route a clause into the review queue on scoring.
AUTO_FLAG_STATUSES = {CoverageStatus.GAPS_FLAGGED, CoverageStatus.CONFLICT_OR_ABSENT}


class StatutoryCitation(BaseModel):
    law_code: str = Field(description="Exact legal code, sourced from the coverage matrix, never hardcoded")
    title: str = Field(description="Official section or article heading")
    text_snippet: str = Field(description="Snippet from the verified, dated statutory text snapshot")
    source_url: str = Field(description="Authoritative regulatory URL")
    statute_retrieved_at: str = Field(description="Date the statutory text snapshot was last verified")
    missing_provisions: List[dict] = Field(
        default_factory=list,
        description=(
            "Per-term pinpoint citations for each missing obligation, e.g. "
            "{'term': 'multi-factor authentication', 'provision': '16 CFR 314.4(c)(5)', "
            "'verified': true}. 'provision' is null and 'verified' is false when the "
            "pinpoint citation hasn't been independently checked - never fabricated."
        ),
    )


class MatchEvaluation(BaseModel):
    matched: bool = Field(description="Whether the clause pertains to the statutory domain")
    calibrated_score: float = Field(ge=0.0, le=1.0, description="Deterministic keyword-coverage score (the gate)")
    llm_reviewed: bool = Field(default=False, description="True if an LLM call actually ran for this match")
    llm_confidence: Optional[float] = Field(default=None, description="Model-reported confidence, only when llm_reviewed")
    statutory_citation: StatutoryCitation
    missing_obligations: List[str] = Field(default_factory=list)
    sanitized_contract_text: str = Field(description="Redacted contract clause with PII stripped")


class ReflectionReport(BaseModel):
    soundness: bool
    notes: str
    llm_reviewed: bool = False
    ambiguity_penalty: float = 0.0
    jurisdictional_specificity: str = "Unspecified"


class AuditScoreOutput(BaseModel):
    status: CoverageStatus
    rationale: str
    review_status: ReviewStatus
    recommended_amendment: str


class ClauseState(TypedDict):
    contract_id: str
    clause: dict
    jurisdiction: str
    topic: str
    coverage_tier: Optional[str]          # P0 / P1 / P2 / None (out of scope)
    regulation_text: str
    statute_retrieved_at: Optional[str]
    match_result: dict
    reflection: dict
    status: str                            # CoverageStatus value, or "out_of_scope"
    review_status: str
    retry_count: int
    audit_log: List[Dict[str, Any]]
    audit_ledger_entry: Optional[dict]
