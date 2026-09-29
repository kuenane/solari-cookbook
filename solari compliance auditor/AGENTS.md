# AGENTS.md — Solari

Guidance for AI agents and engineers working in this repository.

## What this project is

Solari is a **first-pass contract compliance screening tool**. For a defined set of
jurisdictions and legal topics, it checks contract clauses against verified, dated
statutory text using a deterministic keyword gate plus LLM-assisted review for
ambiguous matches, and produces a tamper-evident (SHA-256 hash-chained) audit log.

**It is NOT**: a compliance certification, case-law-aware, a substitute for legal
advice, or a forensic/evidentiary certification. Every non-clean result is routed to
a human review queue (`GET /api/review-queue`). Never describe output as a legal
opinion or a guarantee of compliance.

## Architecture

There is **one backend**: `server.py` (FastAPI). It's the only thing that talks to
LangGraph, the coverage matrix, and the NVIDIA NIM model.

```
Browser (React/Vite)  →  server.ts (Express/Vite, proxy only)  →  server.py (FastAPI)
```

`server.py` owns ALL business logic: `coverage.py` (coverage matrix loader),
`surfaces/desktop.py` (pypdf extraction, topic detection, single ledger writer),
`surfaces/browser.py` (statutory source provider), `pipeline.py` (LangGraph state
machine: retrieve → match → reflect → score → log).

`server.ts` has **no scoring logic, no ledger logic, no LLM calls** — do not add any
there.

## Layout

- `server.ts`, `vite.config.ts`, `index.html` — frontend shell (React 19 + Vite + Tailwind 4)
- `src/` — frontend app (`components/`, `api/`, `hooks/`, `utils/`, `types.ts`)
- `server.py`, `pipeline.py`, `coverage.py`, `state.py`, `counsel_signing.py` — Python backend
- `surfaces/` — `desktop.py` (extraction + single ledger writer), `browser.py` (statutory sources)
- `config/coverage.yaml` — the coverage matrix: the ONLY definition of what is scored
- `config/statutory_texts.yaml` — verified, dated statutory snapshots (source of truth)
- `tests/` — pytest suite, deterministic fixtures in `tests/fixtures/`

## Commands

```bash
# Backend
pip install -r requirements.txt
python server.py                          # FastAPI on :8000

# Frontend (separate terminal)
npm install
npm run dev                               # app on :3000, proxying /api to :8000

# Production build
npm run build && npm start

# Tests / type-check
SOLARI_TEST_FIXTURES=1 pytest tests/ -v   # no API key needed; replays tests/fixtures/
npx tsc --noEmit                          # frontend type-check
```

**Windows note**: PowerShell's execution policy may block `npm.ps1`; use `npm.cmd`
(or `cmd /c`) for npm/npx commands.

## Environment variables (`.env`, gitignored)

- `NVIDIA_API_KEY` — enables LLM-assisted review; without it, every clause is scored
  by the deterministic keyword gate only (`match_result.llm_reviewed` = false). Never
  present gate-only results as equivalent to LLM-reviewed ones.
- `SOLARI_ALLOWED_ORIGINS` — CORS allowlist for the FastAPI backend
- `SOLARI_API_TARGET` — where `server.ts` proxies `/api/*`
- `SOLARI_LIVE_FETCH=1` — opt-in best-effort live fetch of statutory sources (off by
  default; the dated snapshot in `config/statutory_texts.yaml` is canonical)
- `SOLARI_TEST_FIXTURES=1` — replay recorded fixtures instead of calling NVIDIA NIM


## Conventions and invariants

- **Coverage is defined only in `config/coverage.yaml`.** Anything not listed there
  comes back `out_of_scope` — never force-match an out-of-coverage clause against an
  unrelated statute. Each cell has a tier: **P0** (full pipeline), **P1** (full
  pipeline, "provisional" badge), **P2** (heuristic-only, no LLM call).
- **Verdict vocabulary**: `baseline_met` / `gaps_flagged` / `conflict_or_absent` /
  `out_of_scope`. Legacy UI copy saying "VERIFIED", "REJECTED", or "PASSED" is a bug
  — fix it, don't propagate it.
- **The LLM never fully overrides the keyword gate** — its score is blended with a
  deterministic floor. LLM review only runs in the ambiguous band (0.45–0.85) or when
  obligations are missing, and only on P0/P1 sources.
- **Single ledger writer**: only `surfaces/desktop.py` appends to the hash-chained
  ledger. Never write to `audit_ledger.jsonl` / `data/ledger.json` elsewhere.
- **Counsel overrides** are ECDSA P-256 signed client-side (`src/utils/counselSigning.ts`)
  and re-verified server-side (`counsel_signing.py`), including on every
  `/api/ledger/verify` call. Signatures prove key possession and payload integrity —
  NOT identity. Don't imply certified identity anywhere in docs or UI.
- **Citation honesty**: `mandatory_terms` entries carry `verified: true/false`. Never
  silently upgrade an unverified citation; confirm against a primary source and cite
  where it came from.
- **No OCR**: scanned PDFs fall back to canonical demo clauses with a logged warning.
  Do not decode binary bytes as text (that was a former bug).

## Testing guidance

- Run `SOLARI_TEST_FIXTURES=1 pytest tests/ -v` before and after changes; fixture
  replay makes LLM-blending logic testable offline.
- `tests/test_scoring.py` asserts every coverage cell has a valid tier and non-empty
  vocabulary — keep it passing when touching `config/coverage.yaml`.

## Adding a jurisdiction or topic

1. Add a cell to `config/coverage.yaml` (`tier`, `statute_id`, `law_code`,
   `source_url`, jurisdiction/topic-specific `mandatory_terms`).
2. Add the dated snapshot to `config/statutory_texts.yaml`, citing its source.
3. Run `pytest tests/test_scoring.py`.
4. Thin/secondary sources (mirrors, not primary gazettes) get P1/P2, not P0.

## Agent skills

### Issue tracker

Issues and specs are tracked as GitHub Issues on this repo (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
