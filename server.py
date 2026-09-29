"""
Single backend for Solari. Phase 1 fix: server.ts previously duplicated
this entire API (a different ledger implementation, a different scoring
heuristic, a different verdict vocabulary) and was the one actually
wired to the frontend, while this file - the one connected to
LangGraph/NVIDIA NIM - was never invoked by the running app. server.ts
is now a thin static/dev-proxy host only; all business logic lives here.
"""
import hashlib
import json
import os
from typing import AsyncGenerator, Dict, Any, List

from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel

from surfaces.desktop import DesktopSurface, sanitize_pii
from surfaces.browser import StatutorySourceProvider
from coverage import coverage_summary, get_coverage
from counsel_signing import verify_counsel_signature

try:
    from pipeline import app as langgraph_app, _run_clause
    HAS_LANGGRAPH = True
except Exception as e:
    print(f"[Warning] LangGraph pipeline import error: {e}")
    HAS_LANGGRAPH = False

desktop = DesktopSurface()
regulator = StatutorySourceProvider()

api = FastAPI(
    title="Solari Compliance Screening API",
    description="First-pass contract compliance screening. See /api/coverage for what is actually scored.",
    version="3.0.0",
)

# Phase 6 fix: allow_origins=["*"] + allow_credentials=True is an invalid
# combination (most HTTP clients will reject or silently drop credentials
# with it). This app doesn't use cookie-based auth, so credentials stay off.
ALLOWED_ORIGINS = os.environ.get("SOLARI_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
api.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# Phase 4/6: code viewer reads real files instead of a frozen string copy,
# but only from this explicit allowlist - never an arbitrary path.
_SOURCE_ALLOWLIST = {
    "server.py", "pipeline.py", "state.py", "coverage.py",
    "surfaces/desktop.py", "surfaces/browser.py", "main.py",
    "requirements.txt", "README.md", ".env.example",
}
_REPO_ROOT = os.path.dirname(__file__)
UPLOAD_DIR = os.path.join(_REPO_ROOT, "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class OverrideRequest(BaseModel):
    contract_id: str
    clause_id: str
    verdict: str
    counsel_name: str
    counsel_email: str
    bar_number: str
    justification: str
    # Optional ECDSA P-256 signature over the canonical payload (see
    # counsel_signing.py). If omitted, the override is still recorded
    # (fields as plaintext, same as before) but signature_verified is
    # explicitly None ("not attempted"), never a silent True.
    signature: str | None = None
    public_key: str | None = None


class AuditContractRequest(BaseModel):
    contract_id: str = "contract-001"
    contract_text_or_path: str = "sample_contract.pdf"


@api.get("/api/health")
async def health():
    return {
        "status": "online",
        "service": "Solari Compliance Screening API",
        "version": "3.0.0",
        "langgraph_available": HAS_LANGGRAPH,
        "nvidia_api_key_configured": bool(os.environ.get("NVIDIA_API_KEY")),
    }


@api.get("/api/coverage")
async def get_coverage_matrix():
    """
    What this tool actually scores. The frontend reads this to render
    tier badges (P0 full confidence / P1 provisional / P2 limited) instead
    of hardcoding jurisdiction claims in components.
    """
    return {"cells": coverage_summary()}


@api.get("/api/source/{path:path}")
async def get_source(path: str):
    """Serves real, current file contents for the in-app code viewer. Allowlisted paths only."""
    if path not in _SOURCE_ALLOWLIST:
        raise HTTPException(status_code=404, detail="Not in the source viewer allowlist")
    full_path = os.path.join(_REPO_ROOT, path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    with open(full_path, "r", encoding="utf-8") as f:
        return {"path": path, "content": f.read()}


@api.get("/api/clauses")
async def get_clauses(pdf_path: str = Query("sample_contract.pdf")):
    await desktop.start()
    try:
        clauses = await desktop.extract_clauses(pdf_path)
        return {"contract_id": "contract-001", "clauses": clauses, "total_clauses": len(clauses)}
    finally:
        await desktop.stop()


@api.post("/api/audit/run")
async def run_audit_direct(req: AuditContractRequest):
    if not HAS_LANGGRAPH:
        raise HTTPException(status_code=503, detail="Pipeline unavailable")
    await desktop.start()
    await regulator.start()
    try:
        clauses = await desktop.extract_clauses(req.contract_text_or_path)
        results = [await _run_clause(req.contract_id, clause) for clause in clauses]
        return {"contract_id": req.contract_id, "results": results}
    finally:
        await desktop.stop()
        await regulator.stop()


@api.post("/api/contracts/upload")
async def upload_contract(
    file: UploadFile = File(...),
    contract_id: str = Form("contract-001"),
):
    """
    Authoritative document ingestion endpoint.
    Saves the uploaded PDF and extracts clauses via DesktopSurface (pypdf).
    """
    try:
        content = await file.read()
        source_doc_hash = hashlib.sha256(content).hexdigest()
        
        safe_contract_id = "".join(c for c in contract_id if c.isalnum() or c in ("-", "_")) or "contract-001"
        ext = ".pdf" if file.filename.lower().endswith(".pdf") else ".txt"
        file_path = os.path.join(UPLOAD_DIR, f"{safe_contract_id}{ext}")
        with open(file_path, "wb") as f:
            f.write(content)

        await desktop.start()
        try:
            clauses = await desktop.extract_clauses(file_path)
            return {
                "contract_id": safe_contract_id,
                "filename": file.filename,
                "source_doc_hash": source_doc_hash,
                "clauses": clauses,
                "total_clauses": len(clauses),
            }
        finally:
            await desktop.stop()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process uploaded contract: {e}")


@api.get("/api/audit/stream/{contract_id}")
async def stream_audit(contract_id: str, pdf_path: str = Query("sample_contract.pdf")):
    """SSE stream of real pipeline stage transitions - not a scripted/canned sequence."""
    target_path = pdf_path
    if not pdf_path or pdf_path == "sample_contract.pdf":
        for ext in [".pdf", ".txt"]:
            possible = os.path.join(UPLOAD_DIR, f"{contract_id}{ext}")
            if os.path.exists(possible):
                target_path = possible
                break

    async def event_generator() -> AsyncGenerator[Dict[str, Any], None]:
        await desktop.start()
        await regulator.start()
        try:
            clauses = await desktop.extract_clauses(target_path)
            yield {"event": "clauses_extracted", "data": json.dumps({"count": len(clauses), "clauses": clauses})}

            for clause in clauses:
                entry = get_coverage(clause.get("jurisdiction", "US"), clause.get("topic", "out_of_scope"))
                if entry is None:
                    yield {
                        "event": "node_transition",
                        "data": json.dumps({
                            "clause_id": clause["id"], "surface": "coverage-matrix", "node": "scope_check",
                            "level": "info",
                            "message": f"{clause['id']} is out of scope for scoring; extracted only.",
                        }),
                    }
                    continue

                final_state = await _run_clause(contract_id, clause)
                for stage in final_state.get("audit_log", []):
                    yield {
                        "event": "node_transition",
                        "data": json.dumps({
                            "clause_id": clause["id"],
                            "surface": stage.get("surface", "sandbox"),
                            "node": stage.get("stage"),
                            "level": "warn" if final_state.get("status") == "conflict_or_absent" else "info",
                            "message": json.dumps(stage),
                        }),
                    }
                block = final_state.get("audit_ledger_entry")
                if block:
                    yield {
                        "event": "block_committed",
                        "data": json.dumps({
                            "clause_id": clause["id"],
                            "block": block,
                            "final_state": {
                                "status": final_state.get("status"),
                                "review_status": final_state.get("review_status"),
                                "match_result": final_state.get("match_result"),
                                "reflection": final_state.get("reflection"),
                            },
                        }),
                    }

            yield {"event": "audit_complete", "data": json.dumps({"contract_id": contract_id, "status": "completed"})}
        finally:
            await desktop.stop()
            await regulator.stop()

    return EventSourceResponse(event_generator())


@api.post("/api/clauses/override")
async def apply_override(req: OverrideRequest):
    sig_result = verify_counsel_signature(
        signature_b64=req.signature,
        public_key_spki_b64=req.public_key,
        contract_id=req.contract_id, clause_id=req.clause_id, verdict=req.verdict,
        counsel_name=req.counsel_name, counsel_email=req.counsel_email,
        bar_number=req.bar_number, justification=req.justification,
    )
    metadata = {
        "action": "COUNSEL_OVERRIDE",
        "counsel": req.counsel_name,
        "email": req.counsel_email,
        "bar_number": req.bar_number,
        "justification": req.justification,
        # None = no signature submitted (not attempted). True/False = the
        # server independently recomputed and checked an ECDSA signature -
        # never a client-asserted claim taken on trust.
        "signature_attempted": sig_result.attempted,
        "signature_verified": sig_result.verified if sig_result.attempted else None,
        "public_key_fingerprint": sig_result.public_key_fingerprint,
        "signature_reason": sig_result.reason,
        "public_key": req.public_key,
        "signature": req.signature,
    }
    block = await desktop.write_audit_log(
        contract_id=req.contract_id,
        log_entries=[{
            "stage": "counsel_override",
            "clause_id": req.clause_id,
            "new_status": req.verdict,
            "review_status": "counsel_approved" if req.verdict != "conflict_or_absent" else "counsel_rejected",
            "justification": req.justification,
        }],
        metadata=metadata,
    )
    return {
        "status": "committed",
        "receipt": block,
        "signature_verified": sig_result.verified if sig_result.attempted else None,
        "signature_reason": sig_result.reason,
    }


@api.get("/api/ledger")
async def get_ledger():
    entries = []
    if os.path.exists(desktop.ledger_file):
        with open(desktop.ledger_file, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    entries.append(json.loads(line))
    return {"blocks": entries, "count": len(entries)}


@api.get("/api/ledger/verify")
async def verify_ledger():
    """
    Recomputes every block hash server-side - the single source of truth
    for chain validity. For counsel-override blocks carrying a signature,
    also independently RE-VERIFIES the signature against the block's own
    recorded fields (never trusts the signature_verified flag stored at
    write time - that flag could itself have been edited in the ledger
    file, so this endpoint recomputes it fresh every call).
    """
    import hashlib
    if not os.path.exists(desktop.ledger_file):
        return {"valid": True, "blocks_audited": 0, "message": "Ledger is empty"}

    blocks = []
    with open(desktop.ledger_file, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                blocks.append(json.loads(line))

    expected_prev = "0" * 64
    signature_checks = []
    for i, b in enumerate(blocks):
        if b.get("previous_block_hash") != expected_prev:
            return {"valid": False, "broken_at_block": i + 1, "reason": "Chain link broken"}
        payload = {
            "contract_id": b.get("contract_id"), "timestamp": b.get("timestamp"),
            "previous_block_hash": b.get("previous_block_hash"), "log_entries": b.get("log_entries"),
            "metadata": b.get("metadata", {}),
        }
        computed_hash = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()
        if computed_hash != b.get("block_hash"):
            return {"valid": False, "broken_at_block": i + 1, "reason": "Hash mismatch: tampering detected"}

        meta = b.get("metadata", {})
        if meta.get("action") == "COUNSEL_OVERRIDE" and meta.get("public_key") and meta.get("signature"):
            entries = b.get("log_entries", [])
            clause_id = entries[0].get("clause_id") if entries else None
            verdict = entries[0].get("new_status") if entries else None
            result = verify_counsel_signature(
                signature_b64=meta.get("signature"), public_key_spki_b64=meta.get("public_key"),
                contract_id=b.get("contract_id"), clause_id=clause_id, verdict=verdict,
                counsel_name=meta.get("counsel"), counsel_email=meta.get("email"),
                bar_number=meta.get("bar_number"), justification=meta.get("justification"),
            )
            signature_checks.append({"block": i + 1, "clause_id": clause_id, "verified": result.verified, "reason": result.reason})
            if not result.verified:
                return {
                    "valid": False, "broken_at_block": i + 1,
                    "reason": f"Counsel signature failed independent re-verification: {result.reason}",
                }

        expected_prev = b.get("block_hash")

    return {"valid": True, "blocks_audited": len(blocks), "tip_hash": expected_prev, "signature_checks": signature_checks}


@api.get("/api/review-queue")
async def get_review_queue():
    """
    Every clause flagged for counsel review that hasn't since been
    resolved by an override. Phase 0 fix: "flags for human counsel
    review" needs an actual queue, not just a per-clause modal.
    """
    if not os.path.exists(desktop.ledger_file):
        return {"items": []}

    flagged: Dict[str, dict] = {}
    resolved: set = set()
    with open(desktop.ledger_file, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            block = json.loads(line)
            clause_id = block.get("metadata", {}).get("clause_id")
            if not clause_id:
                continue
            if block.get("metadata", {}).get("action") == "COUNSEL_OVERRIDE":
                resolved.add(clause_id)
            elif block.get("metadata", {}).get("review_status") == "flagged_for_counsel":
                flagged[clause_id] = {
                    "clause_id": clause_id,
                    "contract_id": block.get("contract_id"),
                    "status": block.get("metadata", {}).get("status"),
                    "flagged_at": block.get("timestamp"),
                    "block_hash": block.get("block_hash"),
                }

    items = [v for k, v in flagged.items() if k not in resolved]
    return {"items": items, "count": len(items)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(api, host="0.0.0.0", port=8000)
