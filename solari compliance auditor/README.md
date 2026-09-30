# Solari — Compliance Auditor

A **first-pass contract compliance screening tool**. For a defined set of
jurisdictions and legal topics, Solari checks contract clauses against
verified, dated statutory text using a deterministic keyword gate plus
LLM-assisted review for ambiguous matches, and produces a tamper-evident
(SHA-256 hash-chained) audit log.

> ⚖️ **Not legal advice.** See "What this tool is not" below.

## What this tool is not

- **Not a compliance certification.** A `baseline_met` result means the clause
  contains language matching the mandatory terms this tool checks for, under a
  named statute, as of a stated date. It is not a legal opinion that the clause
  (or the contract) is compliant.
- **Not case-law-aware.** It does not know about court decisions, regulatory
  guidance, or statutory amendments after the date shown next to each result.
- **Not a substitute for legal advice.** Every non-clean result is routed to a
  review queue for a human to disposition (`GET /api/review-queue`).
- **Not a forensic/evidentiary certification.** The hash-chained ledger is
  tamper-evidence for this tool's own local record (edits after the fact are
  detectable) — it is a single-writer log, not distributed consensus, and it
  does not by itself establish admissibility under any evidentiary standard in
  any jurisdiction.

## Architecture

There is **one backend**: `server.py` (FastAPI). It's the only thing that talks
to LangGraph, the coverage matrix, and the NVIDIA NIM model.

```
Browser (React 19 / Vite / Tailwind 4)
   │  fetch('/api/...')
   ▼
server.ts  (Express: Vite middleware in dev / static assets in prod)
   │  reverse-proxies /api/* → SOLARI_API_TARGET
   ▼
server.py  (FastAPI — the only backend with business logic)
   │
   ├── coverage.py            → loads config/coverage.yaml + statutory_texts.yaml
   ├── surfaces/desktop.py    → pypdf extraction, topic detection, ledger writer (single writer)
   ├── surfaces/browser.py    → StatutorySourceProvider (verified snapshot; live fetch opt-in)
   └── pipeline.py            → LangGraph: retrieve → match → reflect → score → log
```

Full depth — module-by-module map, API reference, data schemas — lives in
[ARCHITECTURE.md](./ARCHITECTURE.md).

## What it actually covers

Coverage is defined entirely in [`config/coverage.yaml`](config/coverage.yaml)
and served live at `GET /api/coverage`. Anything not listed there is extracted
and displayed but **never scored** — it comes back `out_of_scope` rather than
being force-matched against an unrelated statute.

| Jurisdiction | data_privacy | employment | communications |
|---|---|---|---|
| US | P0 - FTC Safeguards Rule (16 CFR §314) | P0 - FLSA | - |
| EU | P0 - GDPR Art. 28/32 | P1 - EU Labour Directives (not a single enforceable statute) | - |
| UK | P0 - UK GDPR / DPA 2018 | P0 - Employment Rights Act 1996 | - |
| ZA | P1 - POPIA | P1 - BCEA | - |
| LS | P1 - Data Protection Act 2012 | P2 - Labour Code (secondary/ILO-mirrored source) | P2 - Communications Act 2012 |

**Tiers:** **P0** full pipeline (keyword gate + LLM review) · **P1** same
pipeline, "provisional" UI badge · **P2** heuristic-only, no LLM call. SADC-level
"harmonization" claims were deliberately dropped: the SADC Model Law is a
template, not enforceable statute.


## Scoring pipeline

1. **Retrieve** — pull the verified, dated statutory snapshot for the clause's
   `(jurisdiction, topic)` cell.
2. **Match (keyword gate)** — deterministic coverage ratio against that cell's
   own mandatory-term vocabulary (not a single global list shared by every topic).
3. **Match (LLM-assisted)** — only runs when the gate score lands in the
   ambiguous band (0.45–0.85) or obligations are missing, and only on P0/P1
   sources. The NIM model's response is parsed and actually used (blended with,
   never allowed to fully override, the keyword floor).
4. **Reflect** — a second LLM call critiques the match when the match itself was
   LLM-reviewed; otherwise a heuristic note explains what's missing.
5. **Score** — maps to `baseline_met` / `gaps_flagged` / `conflict_or_absent` /
   `out_of_scope`, and auto-routes non-clean results into the review queue
   (`flagged_for_counsel`).
6. **Log** — commits a SHA-256 hash-chained block via the single ledger writer
   in `surfaces/desktop.py`.

## Running it

```bash
# Backend
pip install -r requirements.txt
python server.py            # serves FastAPI on :8000

# Frontend (separate terminal)
npm install
npm run dev                 # serves the app on :3000, proxying /api to :8000
```

Without `NVIDIA_API_KEY` set, scoring falls back to the deterministic keyword
gate only on every clause (`match_result.llm_reviewed` = `false`). Do not treat
gate-only results as equivalent to LLM-reviewed ones.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `NVIDIA_API_KEY` | unset | Enables LLM-assisted review (free tier at https://build.nvidia.com) |
| `SOLARI_ALLOWED_ORIGINS` | `http://localhost:3000` | CORS allowlist for the FastAPI backend |
| `SOLARI_API_TARGET` | `http://localhost:8000` | Where `server.ts` proxies `/api/*` |
| `SOLARI_LIVE_FETCH` | off | `=1` to best-effort live-fetch statutory sources before the snapshot |
| `SOLARI_TEST_FIXTURES` | off | `=1` in tests: replay `tests/fixtures/` instead of calling NIM |

### Tests

```bash
SOLARI_TEST_FIXTURES=1 pytest tests/ -v   # deterministic, no live API key needed
npx tsc --noEmit                          # frontend type-check
```

## Known limitations (tracked, not hidden)

- **PDF extraction has no OCR.** Scanned/image-only PDFs yield no extractable
  text via `pypdf` and fall back to canonical demo clauses with a logged warning.
- **Live statutory-source fetching is opt-in** (`SOLARI_LIVE_FETCH=1`) and
  best-effort only. The verified, dated snapshot in `config/statutory_texts.yaml`
  is the source of truth; it needs a manual review cadence to stay current.
- **Per-term statutory citations are a mix of verified and unverified.** Each
  `mandatory_terms` entry carries a `verified: true/false` flag; `false` means
  best-effort, not fabricated precision — confirm before relying on them.
- **Counsel overrides are cryptographically signed, not identity-verified.**
  ECDSA P-256 signatures prove key possession and payload integrity, not that the
  key belongs to the named person (self-asserted trust model, like an unverified
  PGP/SSH key).
- **Frontend verdict vocabulary**: renamed to `baseline_met` / `gaps_flagged` /
  `conflict_or_absent` / `out_of_scope` at the type/data layer; any remaining
  "VERIFIED"/"REJECTED" display copy is a bug — flag it.
- **Employment/communications vocabularies are a first pass**; POPIA, BCEA, and
  Lesotho citations are `verified: false` pending primary-source research.

## Contributing a jurisdiction or topic

1. Add a cell to `config/coverage.yaml` (`tier`, `statute_id`, `law_code`,
   `source_url`, and a `mandatory_terms` list specific to that pair).
2. Add the dated snapshot to `config/statutory_texts.yaml`, citing its source.
3. Run `pytest tests/test_scoring.py` — it asserts every cell has a valid tier
   and a non-empty vocabulary.
4. Thin or secondary sources (a mirror, not the primary gazette) → mark P1 or P2.
