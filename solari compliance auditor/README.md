# Solari

Solari is a **first-pass contract compliance screening tool**. For a
defined set of jurisdictions and legal topics, it checks contract clauses
against verified, dated statutory text using a deterministic keyword gate
plus LLM-assisted review for ambiguous matches, and produces a
tamper-evident audit log.

## What this tool is not

- **Not a compliance certification.** A "baseline met" result means the
  clause contains language matching the mandatory terms this tool checks
  for, under a named statute, as of a stated date. It is not a legal
  opinion that the clause (or the contract) is compliant.
- **Not case-law-aware.** It does not know about court decisions,
  regulatory guidance, or statutory amendments after the date shown next
  to each result.
- **Not a substitute for legal advice.** Every non-clean result is routed
  to a review queue for a human to disposition (`GET /api/review-queue`).
- **Not a forensic/evidentiary certification.** The hash-chained ledger is
  tamper-evidence for this tool's own local record (edits after the fact
  are detectable) - it is a single-writer log, not distributed consensus,
  and it does not by itself establish admissibility under any evidentiary
  standard in any jurisdiction.

## What it actually covers

Coverage is defined entirely in [`config/coverage.yaml`](config/coverage.yaml)
and served live at `GET /api/coverage`. Anything not listed there is
extracted and displayed but **never scored** - it comes back `out_of_scope`
rather than being force-matched against an unrelated statute.

| Jurisdiction | data_privacy | employment | communications |
|---|---|---|---|
| US | P0 - FTC Safeguards Rule (16 CFR §314) | P0 - FLSA | - |
| EU | P0 - GDPR Art. 28/32 | P1 - EU Labour Directives (not a single enforceable statute) | - |
| UK | P0 - UK GDPR / DPA 2018 | P0 - Employment Rights Act 1996 | - |
| ZA | P1 - POPIA | P1 - BCEA | - |
| LS | P1 - Data Protection Act 2012 | P2 - Labour Code (secondary/ILO-mirrored source) | P2 - Communications Act 2012 |

**Tier meaning:**
- **P0** - full pipeline (keyword gate + LLM-assisted review on ambiguous
  matches). Source text is well-structured and independently verifiable.
- **P1** - same pipeline, but the UI shows a "provisional" badge because
  the source text is thinner or less centrally published.
- **P2** - heuristic-only, no LLM call (not worth spending a model call on
  a secondary-source statute mirror). UI shows a "limited coverage" badge.

SADC-level "harmonization" claims were deliberately dropped: the SADC
Model Law is a template for member states to adopt, not enforceable
statute on its own, and scoring against it implied an enforceability that
doesn't exist.

## Architecture

There is **one backend**: `server.py` (FastAPI). It's the only thing that
talks to LangGraph, the coverage matrix, and the NVIDIA NIM model.

```
Browser (React/Vite)
   │  fetch('/api/...')
   ▼
server.ts  (Express: static assets in prod / Vite middleware in dev)
   │  reverse-proxies /api/* to SOLARI_API_TARGET
   ▼
server.py  (FastAPI - the only backend with business logic)
   │
   ├── coverage.py            → loads config/coverage.yaml + statutory_texts.yaml
   ├── surfaces/desktop.py    → pypdf extraction, topic detection, ledger writer (single writer)
   ├── surfaces/browser.py    → StatutorySourceProvider (verified snapshot; live fetch is opt-in)
   └── pipeline.py            → LangGraph state machine: retrieve → match → reflect → score → log
```

`server.ts` has no scoring logic, no ledger logic, and no LLM calls of its
own - previously it did (a second, independent implementation of all
three, disconnected from the FastAPI/LangGraph side entirely, and it was
the one the frontend actually talked to). That's fixed: one backend now.

## Scoring pipeline

1. **Retrieve** - pull the verified, dated statutory snapshot for the
   clause's `(jurisdiction, topic)` cell.
2. **Match (keyword gate)** - deterministic coverage ratio against that
   cell's own mandatory-term vocabulary (not a single global list shared
   by every topic).
3. **Match (LLM-assisted)** - only runs when the gate score lands in the
   ambiguous band (0.45-0.85) or obligations are missing, and only on
   P0/P1 sources. The NIM model's response is parsed and actually used
   (blended with, never allowed to fully override, the keyword floor) -
   not discarded.
4. **Reflect** - a second LLM call critiques the match when the match
   itself was LLM-reviewed; otherwise a heuristic note explains what's
   missing.
5. **Score** - maps to `baseline_met` / `gaps_flagged` / `conflict_or_absent`
   / `out_of_scope`, and auto-routes non-clean results into the review
   queue (`ReviewStatus.FLAGGED_FOR_COUNSEL`).
6. **Log** - commits a SHA-256 hash-chained block via the single ledger
   writer in `surfaces/desktop.py`.

## Running it

```bash
# Backend
pip install -r requirements.txt
cp .env.example .env   # add NVIDIA_API_KEY for LLM-assisted review
python server.py       # serves FastAPI on :8000

# Frontend (separate terminal)
npm install
npm run dev             # serves the app on :3000, proxying /api to :8000
```

Without `NVIDIA_API_KEY` set, scoring falls back to the deterministic
keyword gate only on every clause - `match_result.llm_reviewed` will be
`false`. Do not treat gate-only results as equivalent to LLM-reviewed
ones; the UI does not currently distinguish them beyond that field, so
check it if you need to know which mode produced a given result.

### Tests

```bash
SOLARI_TEST_FIXTURES=1 pytest tests/ -v   # deterministic, no live API key needed
npx tsc --noEmit                          # frontend type-check
```

`SOLARI_TEST_FIXTURES=1` replays recorded JSON responses from
`tests/fixtures/` instead of calling NVIDIA NIM, so the LLM-blending logic
has a real regression test without needing network access or a key.

## Known limitations (tracked, not hidden)

- **PDF extraction has no OCR.** Scanned/image-only PDFs yield no
  extractable text via `pypdf` and fall back to canonical demo clauses
  with a logged warning, rather than the old behavior of decoding binary
  bytes as UTF-8 and treating the garbage as clause text.
- **Live statutory-source fetching is opt-in** (`SOLARI_LIVE_FETCH=1`) and
  best-effort only. The verified, dated snapshot in
  `config/statutory_texts.yaml` is the source of truth; it needs a manual
  review cadence to stay current, not a scraper.
- **Per-term statutory citations are a mix of verified and unverified.**
  Each entry in `config/coverage.yaml`'s `mandatory_terms` carries a
  `verified: true/false` flag - `true` only where the pinpoint citation
  was checked against a primary or authoritative secondary source (see
  the research notes in that file's comments; several US/UK/ZA citations
  were verified this way, including a correction: UK holiday entitlement
  is under the Working Time Regulations 1998, not the Employment Rights
  Act 1996 as an earlier version of this file claimed). `verified: false`
  citations are honest best-effort, not fabricated precision - confirm
  before relying on them.
- **Counsel overrides are cryptographically signed, not identity-verified.**
  Each override is signed client-side with an ECDSA P-256 key (generated
  in-browser via Web Crypto, see `src/utils/counselSigning.ts`), and the
  server independently re-verifies the signature against the payload
  (`counsel_signing.py`) - both at write time and again on every
  `/api/ledger/verify` call, so editing the ledger file and recomputing
  its hash still fails signature re-verification. What this proves:
  whoever submitted the override held the private key, and the payload
  hasn't been altered since signing. What it does NOT prove: that the key
  belongs to the named person - key-to-identity binding is the same
  self-asserted trust model as an unverified PGP/SSH key, not a certified
  digital identity, and that limitation is surfaced in the UI rather than
  implied away.
- **The frontend verdict-vocabulary rename is complete at the type/data
  layer**, but some legacy display copy in less-central views may still
  need a pass - if you find "VERIFIED"/"REJECTED" language anywhere, it's
  a bug, not an intentional label; please flag it.
- **Employment/communications vocabularies are a first pass.** POPIA,
  BCEA, and the Lesotho statutes have `verified: false` citations pending
  further research; contributions to firm these up should come with a
  cited primary source per term.

## Contributing a jurisdiction or topic

1. Add a cell to `config/coverage.yaml` with a `tier`, `statute_id`,
   `law_code`, `source_url`, and a `mandatory_terms` list specific to that
   (jurisdiction, topic) pair.
2. Add the corresponding dated snapshot to `config/statutory_texts.yaml`,
   citing where the text came from.
3. Run `pytest tests/test_scoring.py` - it asserts every cell has a valid
   tier and a non-empty vocabulary.
4. If the source is thin or secondary (a mirror, not the primary gazette),
   mark it P1 or P2 rather than P0 - see the tier definitions above.
