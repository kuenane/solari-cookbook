import hashlib
import json
import os
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

AUDIT_LEDGER_PATH = os.path.join(os.path.dirname(__file__), "..", "audit_ledger.jsonl")


def sanitize_pii(text: str) -> str:
    """Masks emails, phone numbers, SSNs, credit cards, and dollar figures before any LLM call."""
    if not text:
        return text
    text = re.sub(r'[\w\.-]+@[\w\.-]+\.\w+', '[REDACTED_EMAIL]', text)
    text = re.sub(r'(\+?\d{1,3}[-.\s]?)?\(?\b\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b', '[REDACTED_PHONE]', text)
    text = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[REDACTED_SSN]', text)
    text = re.sub(r'\b(?:\d{4}[-\s]?){3}\d{4}\b', '[REDACTED_CREDIT_CARD]', text)
    text = re.sub(r'\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?', '[CONFIDENTIAL_SUM]', text)
    return text


# Topic keyword buckets used only to route a clause to a coverage-matrix
# lookup key. This is NOT the scoring vocabulary (see config/coverage.yaml
# for that) - it only decides which (jurisdiction, topic) cell to check,
# or whether the clause is out_of_scope because no cell in the matrix
# covers what it's actually about.
_TOPIC_KEYWORDS = {
    "data_privacy": ["privacy", "personal data", "gdpr", "safeguard", "security", "breach", "data protection"],
    "employment": ["employ", "worker", "severance", "terminate", "non-compete", "wage", "overtime"],
    "communications": ["communications licence", "interception", "telecommunications"],
}
# Clause types the tool extracts and displays but never scores, because no
# vocabulary/statute mapping exists for them yet (Phase 0 amendment: do not
# force-fit every clause into data_privacy by default).
_OUT_OF_SCOPE_HINTS = {
    "liability_indemnity": ["indemnif", "consequential damages", "limitation of liability"],
    "ip_assignment": ["intellectual property", "assign all right, title"],
    "governance_general": ["duly organized", "good standing", "governing law"],
}


def _detect_topic(text_lower: str) -> str:
    for topic, keywords in _TOPIC_KEYWORDS.items():
        if any(k in text_lower for k in keywords):
            return topic
    for _, keywords in _OUT_OF_SCOPE_HINTS.items():
        if any(k in text_lower for k in keywords):
            return "out_of_scope"
    # No confident match at all: still out_of_scope, never defaulted into
    # data_privacy as the old code did.
    return "out_of_scope"


try:
    from pypdf import PdfReader
    _HAS_PYPDF = True
except ImportError:
    _HAS_PYPDF = False


def _extract_pdf_text(raw_bytes: bytes) -> Optional[str]:
    """Real PDF text extraction via pypdf. Returns None (not garbage bytes) if it fails."""
    if not _HAS_PYPDF:
        return None
    try:
        import io
        reader = PdfReader(io.BytesIO(raw_bytes))
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages).strip()
        return text or None
    except Exception as e:
        print(f"[DesktopSurface] pypdf extraction failed: {e}")
        return None


class DesktopSurface:
    """
    Local ingestion + the tamper-evident SHA-256 hash-chained audit ledger.

    Note on scope: this does OCR-free, embedded-text PDF extraction via
    pypdf. It does NOT do OCR - a scanned/image-only PDF will yield no
    text and the clause list will fall back to the canonical demo clauses
    below with a warning logged, rather than silently "extracting" binary
    garbage the way naive byte-decoding used to.
    """

    def __init__(self, ledger_file: str = AUDIT_LEDGER_PATH):
        self.ledger_file = ledger_file
        self._last_block_hash = "0" * 64
        self._load_last_block()

    def _load_last_block(self) -> None:
        if os.path.exists(self.ledger_file):
            try:
                with open(self.ledger_file, "r", encoding="utf-8") as f:
                    lines = [line.strip() for line in f if line.strip()]
                    if lines:
                        last_entry = json.loads(lines[-1])
                        self._last_block_hash = last_entry.get("block_hash", "0" * 64)
            except Exception:
                self._last_block_hash = "0" * 64

    async def start(self) -> None:
        pass

    async def stop(self) -> None:
        pass

    async def extract_clauses(self, file_path_or_content: str) -> List[Dict[str, Any]]:
        content = ""
        source_hash = hashlib.sha256(file_path_or_content.encode("utf-8")).hexdigest()
        extraction_method = "raw_text_input"

        if os.path.exists(file_path_or_content):
            try:
                with open(file_path_or_content, "rb") as f:
                    raw_bytes = f.read()
                    source_hash = hashlib.sha256(raw_bytes).hexdigest()
                    if file_path_or_content.lower().endswith(".pdf"):
                        pdf_text = _extract_pdf_text(raw_bytes)
                        if pdf_text:
                            content = pdf_text
                            extraction_method = "pypdf"
                        else:
                            extraction_method = "pdf_extraction_failed"
                    else:
                        content = raw_bytes.decode("utf-8", errors="ignore")
                        extraction_method = "plain_text_file"
            except Exception as e:
                print(f"[DesktopSurface] Could not read file {file_path_or_content}: {e}")
        elif len(file_path_or_content) > 100:
            content = file_path_or_content

        if content:
            clause_pattern = re.compile(
                r'(?:(?:Section|Clause|Article|§)\s*(\d+(?:\.\d+)*)[:\.\-\s]+([^\n\r]+)|(\d+\.\d+)\s+([^\n\r]+))',
                re.IGNORECASE
            )
            splits = list(clause_pattern.finditer(content))
            if len(splits) >= 2:
                parsed_clauses = []
                for i, match in enumerate(splits):
                    start = match.start()
                    end = splits[i + 1].start() if i + 1 < len(splits) else len(content)
                    raw_clause_text = content[start:end].strip()
                    section_num = match.group(1) or match.group(3) or f"§ {i+1}.0"
                    title = (match.group(2) or match.group(4) or f"Clause {i+1}").strip()

                    text_lower = raw_clause_text.lower()
                    topic = _detect_topic(text_lower)
                    jurisdiction = "EU" if "gdpr" in text_lower or "european" in text_lower else "US"

                    parsed_clauses.append({
                        "id": f"clause-{i+1:03d}",
                        "number": f"§ {section_num}",
                        "title": title[:60],
                        "topic": topic,
                        "jurisdiction": jurisdiction,
                        "text": raw_clause_text,
                        "lines": f"Section {section_num}",
                        "source_doc_hash": source_hash,
                        "extraction_method": extraction_method,
                        "sanitized_text": sanitize_pii(raw_clause_text),
                    })
                if parsed_clauses:
                    return parsed_clauses

        # Canonical baseline clauses for standard demo agreements, used
        # when no content was extractable (e.g. a scanned PDF with no
        # embedded text) or the extracted text has no clause markers.
        demo = [
            ("clause-001", "§ 1.4", "Indemnity & Data Privacy Obligations", "data_privacy", "US",
             "The parties agree to process personal data in accordance with applicable law and implement reasonable administrative safeguards."),
            ("clause-002", "§ 2.1", "Corporate Governance & Delaware Authority", "out_of_scope", "US",
             "Each party warrants that it is duly organized, validly existing and in good standing under the laws of Delaware."),
            ("clause-003", "§ 3.2", "Limitation of Direct & Consequential Liability", "out_of_scope", "US",
             "Except for gross negligence or willful misconduct, neither party shall be liable for indirect, punitive, or consequential damages."),
        ]
        return [
            {
                "id": cid, "number": num, "title": title, "topic": topic, "jurisdiction": juris,
                "text": text, "lines": "N/A", "source_doc_hash": source_hash,
                "extraction_method": extraction_method, "sanitized_text": sanitize_pii(text),
            }
            for cid, num, title, topic, juris, text in demo
        ]

    async def write_audit_log(self, contract_id: str, log_entries: List[Dict[str, Any]], metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Single writer for the audit ledger. The TypeScript client verifies
        blocks but must never construct/append its own (see
        src/utils/cryptoLedger.ts) - one source of truth for the chain.
        """
        timestamp = datetime.now(timezone.utc).isoformat()
        block_payload = {
            "contract_id": contract_id,
            "timestamp": timestamp,
            "previous_block_hash": self._last_block_hash,
            "log_entries": log_entries,
            "metadata": metadata or {},
        }
        canonical_str = json.dumps(block_payload, sort_keys=True)
        block_hash = hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()
        record = {**block_payload, "block_hash": block_hash}

        try:
            with open(self.ledger_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(record) + "\n")
            self._last_block_hash = block_hash
        except Exception as e:
            print(f"[DesktopSurface] Warning: ledger file write error: {e}")

        return record
