"""
Single loader for the coverage matrix (config/coverage.yaml) and the
versioned statutory text snapshots (config/statutory_texts.yaml).

This replaces the old REGULATION_SOURCES dict that was hardcoded inside
pipeline.py, and is the one place that knows which (jurisdiction, topic)
pairs are in scope, at what tier, with which vocabulary.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Optional

import yaml

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "config")
COVERAGE_PATH = os.path.join(CONFIG_DIR, "coverage.yaml")
STATUTES_PATH = os.path.join(CONFIG_DIR, "statutory_texts.yaml")

VALID_TIERS = {"P0", "P1", "P2"}


@dataclass
class MandatoryTerm:
    term: str
    provision: Optional[str] = None
    verified: bool = False
    note: Optional[str] = None


@dataclass
class CoverageEntry:
    jurisdiction: str
    topic: str
    tier: str
    statute_id: str
    law_code: str
    source_url: str
    mandatory_terms: list[MandatoryTerm] = field(default_factory=list)
    note: Optional[str] = None

    @property
    def term_strings(self) -> list[str]:
        """Plain keyword list for the scoring gate - see calculate_grounding_score."""
        return [t.term for t in self.mandatory_terms]

    def provision_for(self, term: str) -> Optional[MandatoryTerm]:
        """Looks up the citation record for a specific matched/missing term."""
        for t in self.mandatory_terms:
            if t.term == term:
                return t
        return None

    @property
    def llm_eligible(self) -> bool:
        """P2 sources are too thin to justify spending a model call on."""
        return self.tier in ("P0", "P1")

    @property
    def badge(self) -> Optional[str]:
        if self.tier == "P1":
            return "Provisional - statutory source not independently verified"
        if self.tier == "P2":
            return "Limited coverage - source is a secondary mirror, confirm with local counsel"
        return None


@dataclass
class StatuteText:
    statute_id: str
    text: str
    retrieved_at: str


@lru_cache(maxsize=1)
def _load_raw() -> dict:
    with open(COVERAGE_PATH, "r", encoding="utf-8") as f:
        coverage_raw = yaml.safe_load(f) or {}
    with open(STATUTES_PATH, "r", encoding="utf-8") as f:
        statutes_raw = yaml.safe_load(f) or {}
    return {"coverage": coverage_raw, "statutes": statutes_raw}


@lru_cache(maxsize=1)
def load_coverage_matrix() -> dict[tuple[str, str], CoverageEntry]:
    raw = _load_raw()["coverage"].get("jurisdictions", {})
    matrix: dict[tuple[str, str], CoverageEntry] = {}
    for jurisdiction, topics in raw.items():
        for topic, cell in topics.items():
            tier = cell.get("tier")
            if tier not in VALID_TIERS:
                raise ValueError(
                    f"Invalid tier '{tier}' for ({jurisdiction}, {topic}); "
                    f"must be one of {VALID_TIERS}"
                )
            matrix[(jurisdiction, topic)] = CoverageEntry(
                jurisdiction=jurisdiction,
                topic=topic,
                tier=tier,
                statute_id=cell["statute_id"],
                law_code=cell["law_code"],
                source_url=cell["source_url"],
                mandatory_terms=[
                    MandatoryTerm(
                        term=t["term"],
                        provision=t.get("provision"),
                        verified=bool(t.get("verified", False)),
                        note=t.get("note"),
                    )
                    for t in cell.get("mandatory_terms", [])
                ],
                note=cell.get("note"),
            )
    return matrix


@lru_cache(maxsize=1)
def load_statute_texts() -> dict[str, StatuteText]:
    raw = _load_raw()["statutes"]
    return {
        statute_id: StatuteText(
            statute_id=statute_id,
            text=(entry.get("text") or "").strip(),
            retrieved_at=entry.get("retrieved_at", "unknown"),
        )
        for statute_id, entry in raw.items()
    }


def get_coverage(jurisdiction: str, topic: str) -> Optional[CoverageEntry]:
    """Returns the coverage entry for (jurisdiction, topic), or None if out of scope."""
    return load_coverage_matrix().get((jurisdiction, topic))


def get_statute_text(statute_id: str) -> Optional[StatuteText]:
    return load_statute_texts().get(statute_id)


def known_topics() -> set[str]:
    return {topic for (_, topic) in load_coverage_matrix().keys()}


def known_jurisdictions() -> set[str]:
    return {j for (j, _) in load_coverage_matrix().keys()}


def coverage_summary() -> list[dict]:
    """Flat list for the /api/coverage endpoint the frontend reads to render badges."""
    out = []
    for (jurisdiction, topic), entry in sorted(load_coverage_matrix().items()):
        statute = get_statute_text(entry.statute_id)
        out.append({
            "jurisdiction": jurisdiction,
            "topic": topic,
            "tier": entry.tier,
            "law_code": entry.law_code,
            "source_url": entry.source_url,
            "badge": entry.badge,
            "note": entry.note,
            "statute_retrieved_at": statute.retrieved_at if statute else None,
            "mandatory_terms": [
                {
                    "term": t.term,
                    "provision": t.provision,
                    "verified": t.verified,
                    "note": t.note,
                }
                for t in entry.mandatory_terms
            ],
        })
    return out
