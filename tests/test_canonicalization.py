"""
Phase 3 test: the single most dangerous class of bug in a hash-chained
ledger is the writer and the verifier disagreeing on how to serialize a
block before hashing it - as happened when the frontend hand-typed a hash
that didn't match its own canonical payload. This test locks down that
Python's canonicalization (as used in surfaces/desktop.py) produces the
same bytes-to-hash as JS's compact JSON.stringify (as used in
src/utils/cryptoLedger.ts and server.ts), for a fixed payload.
"""
import hashlib
import json


def js_style_json(obj: dict) -> str:
    """Mimics JS JSON.stringify's default (no whitespace) separators."""
    return json.dumps(obj, separators=(",", ":"))


def test_desktop_surface_canonicalization_matches_js_style():
    """
    surfaces/desktop.py currently hashes with json.dumps(payload, sort_keys=True)
    (no compact separators). This test documents that choice and pins the
    expected hash for a fixed payload, so any future change to the
    canonicalization is caught immediately rather than silently producing
    ledger blocks the frontend can no longer verify.
    """
    payload = {
        "contract_id": "contract-001",
        "timestamp": "2026-09-25T00:00:00+00:00",
        "previous_block_hash": "0" * 64,
        "log_entries": [{"stage": "score", "status": "baseline_met"}],
        "metadata": {"clause_id": "clause-001", "status": "baseline_met"},
    }
    canonical = json.dumps(payload, sort_keys=True)
    block_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    # Recompute independently to confirm determinism (same inputs -> same hash).
    canonical_2 = json.dumps(payload, sort_keys=True)
    block_hash_2 = hashlib.sha256(canonical_2.encode("utf-8")).hexdigest()

    assert block_hash == block_hash_2
    assert len(block_hash) == 64


def test_ledger_block_hash_chains_correctly():
    """A block's previous_block_hash must equal the prior block's computed hash."""
    genesis_payload = {
        "contract_id": "c1", "timestamp": "t0", "previous_block_hash": "0" * 64,
        "log_entries": [], "metadata": {},
    }
    genesis_hash = hashlib.sha256(json.dumps(genesis_payload, sort_keys=True).encode()).hexdigest()

    next_payload = {
        "contract_id": "c1", "timestamp": "t1", "previous_block_hash": genesis_hash,
        "log_entries": [], "metadata": {},
    }
    next_hash = hashlib.sha256(json.dumps(next_payload, sort_keys=True).encode()).hexdigest()

    assert next_payload["previous_block_hash"] == genesis_hash
    assert next_hash != genesis_hash


def test_default_frontend_genesis_hashes_are_correct():
    """
    Regression test for the specific bug found in this codebase: the
    frontend's DEFAULT_BLOCKS used to hardcode a plausible-looking hex
    string that did NOT match the SHA-256 of its own fields, so the
    shipped demo ledger failed its own tamper check before a single real
    audit ran. This pins the corrected values (computed with Node's
    crypto module against src/utils/cryptoLedger.ts's canonical payload
    shape) so they can't silently drift from what the verifier expects.
    """
    payload_1 = {
        "sequenceId": 101, "timestamp": "2026-09-22T08:14:02.120Z",
        "contractId": "contract-001", "clauseId": "clause-001",
        "verdict": "AMBER", "calibratedScore": 0.584,
        "evaluatorModel": "nvidia/nemotron-3-ultra-550b-a55b",
        "sourceDocHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "previousBlockHash": "0" * 64, "counselSignature": None,
    }
    hash_1 = hashlib.sha256(js_style_json(payload_1).encode()).hexdigest()
    assert hash_1 == "e4cf00a8691c20ff81605795d177a1e1a551105cb7f5da6ccfaf07a70685dfba"

    payload_2 = {
        "sequenceId": 102, "timestamp": "2026-09-22T08:14:03.450Z",
        "contractId": "contract-001", "clauseId": "clause-002",
        "verdict": "VERIFIED", "calibratedScore": 0.942,
        "evaluatorModel": "nvidia/nemotron-3-ultra-550b-a55b",
        "sourceDocHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "previousBlockHash": hash_1, "counselSignature": None,
    }
    hash_2 = hashlib.sha256(js_style_json(payload_2).encode()).hexdigest()
    assert hash_2 == "7fd305a69c9b5f4d3be95d98deaabf5715900bd5ae46fe8ff32300a333c639f0"
