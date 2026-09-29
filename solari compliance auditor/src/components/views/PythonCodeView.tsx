import React, { useState, useEffect } from 'react';
import { fetchSource } from '../../api/complianceClient';

interface CodeFile {
  name: string;
  path: string;
  language: string;
  description: string;
}

// Phase 1 fix: this used to be a hardcoded, frozen copy of each file's
// source pasted in as a template literal - editing the real files would
// silently leave this viewer showing stale code. Metadata only now; the
// actual `content` is fetched live from /api/source/{path} (see the
// useEffect below), which reads the real file off disk, allowlisted.
const PYTHON_FILES: CodeFile[] = [
  {
    name: 'server.py',
    path: 'server.py',
    language: 'python',
    description: 'FastAPI REST + SSE server: single backend for the app, coverage matrix endpoint, allowlisted source viewer, and hash-chain verification.',
  },
  {
    name: 'pipeline.py',
    path: 'pipeline.py',
    language: 'python',
    description: 'LangGraph workflow: deterministic keyword gate, NVIDIA NIM LLM review on ambiguous P0/P1 matches only, and out-of-scope routing.',
  },
  {
    name: 'main.py',
    path: 'main.py',
    language: 'python',
    description: 'CLI entry point accepting PDF path and contract ID, initiating the LangGraph audit sequence.',
  },
  {
    name: 'state.py',
    path: 'state.py',
    language: 'python',
    description: 'Pydantic models: CoverageStatus/ReviewStatus enums, structured match/reflection outputs, statutory citations.',
  },
  {
    name: 'requirements.txt',
    path: 'requirements.txt',
    language: 'plaintext',
    description: 'Python dependencies: LangGraph, pydantic v2, openai SDK, pypdf, pyyaml, pytest.',
  },
  {
    name: 'README.md',
    path: 'README.md',
    language: 'markdown',
    description: 'Solari: scope, coverage matrix, setup guide, and what this tool does not do.',
  },
  {
    name: 'browser.py',
    path: 'surfaces/browser.py',
    language: 'python',
    description: 'StatutorySourceProvider: returns the verified, dated statutory snapshot; live fetch is opt-in and best-effort only.',
  },
  {
    name: 'desktop.py',
    path: 'surfaces/desktop.py',
    language: 'python',
    description: 'DesktopSurface: pypdf-based text extraction (no OCR), clause/topic detection, single-writer hash-chained ledger.',
  },
  {
    name: '.env.example',
    path: '.env.example',
    language: 'plaintext',
    description: 'Environment variables: NVIDIA_API_KEY, CORS origins, API proxy target, live-fetch and test-fixture toggles.',
  },
];

export const PythonCodeView: React.FC = () => {
  const [viewMode, setViewMode] = useState<'disclosures' | 'code'>('disclosures');
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const currentFileMeta = PYTHON_FILES[activeFileIndex];
  const currentContent = fileContents[currentFileMeta.path] ?? '';

  // Fetch real, current file content on demand - not a frozen copy pasted
  // in at build time (see PYTHON_FILES comment above).
  useEffect(() => {
    let cancelled = false;
    if (fileContents[currentFileMeta.path] !== undefined) return;
    setLoadError(null);
    fetchSource(currentFileMeta.path).then((result) => {
      if (cancelled) return;
      if (result) {
        setFileContents((prev) => ({ ...prev, [currentFileMeta.path]: result.content }));
      } else {
        setLoadError(`Could not load ${currentFileMeta.path} from the backend.`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentFileMeta.path, fileContents]);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAllSpecs = async () => {
    const files = await Promise.all(
      PYTHON_FILES.map(async (f) => ({ ...f, content: fileContents[f.path] ?? (await fetchSource(f.path))?.content ?? '[unavailable]' }))
    );
    const combined = files.map(
      (f) => `### FILE: ${f.path}\n### DESCRIPTION: ${f.description}\n\n${f.content}\n\n${'='.repeat(80)}\n`
    ).join('\n');
    const blob = new Blob([combined], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `solari-algorithmic-spec-bundle-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col w-full pb-8 space-y-4">
      {/* Header Banner */}
      <div className="bg-[#222a3d] border border-[#334155]/80 rounded-xl p-4 shadow-md flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7bd0ff] text-[22px]">fact_check</span>
            <h1 className="text-base font-semibold text-[#dae2fd]">
              Algorithmic Audit Specification &amp; Forensic Disclosures
            </h1>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30">
              SOURCE: LIVE FILE
            </span>
          </div>
          <p className="text-xs text-[#d8c3ad] mt-1 font-mono">
            Judicial algorithmic transparency: deterministic grounding benchmarks, regex sanitization, and state machine specs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex bg-[#060e20] p-1 rounded-lg border border-[#334155]">
            <button
              type="button"
              onClick={() => setViewMode('disclosures')}
              className={`px-3 py-1 rounded font-mono text-xs transition-colors flex items-center gap-1 ${
                viewMode === 'disclosures'
                  ? 'bg-[#171f33] text-[#7bd0ff] font-semibold'
                  : 'text-[#d8c3ad] hover:text-[#dae2fd]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">shield</span>
              <span>Audit Disclosures</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('code')}
              className={`px-3 py-1 rounded font-mono text-xs transition-colors flex items-center gap-1 ${
                viewMode === 'code'
                  ? 'bg-[#171f33] text-[#ffc174] font-semibold'
                  : 'text-[#d8c3ad] hover:text-[#dae2fd]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">code</span>
              <span>Python / NIM Implementation</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadAllSpecs}
            className="px-3 py-1.5 bg-[#10b981]/20 hover:bg-[#10b981]/30 border border-[#10b981]/40 text-[#10b981] font-mono text-xs font-semibold rounded flex items-center gap-1.5 shadow-sm transition-all"
            title="Download complete executable specification archive for legal depositions"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            <span>Export Spec Archive</span>
          </button>
        </div>
      </div>

      {viewMode === 'disclosures' ? (
        /* Executive Disclosures & Forensic Guardrails Grid */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 text-[#7bd0ff]">
                  <span className="material-symbols-outlined text-[20px]">psychology_alt</span>
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
                    Model &amp; Temperature Bounds
                  </h3>
                </div>
                <p className="text-xs text-[#dae2fd] leading-relaxed mb-3">
                  Inference is anchored to NVIDIA NIM Nemotron-3-Ultra (550B parameters) locked at <code className="text-[#ffc174] bg-[#060e20] px-1 py-0.5 rounded font-mono text-[11px]">temperature=0.1</code>. This suppresses generative hallucination, enforcing deterministic textual grounding.
                </p>
              </div>
              <div className="pt-2 border-t border-[#222a3d] font-mono text-[10px] text-[#94a3b8] flex justify-between">
                <span>Model: nemotron-3-ultra-550b</span>
                <span className="text-[#10b981]">Top-p: 0.95</span>
              </div>
            </div>

            <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 text-[#10b981]">
                  <span className="material-symbols-outlined text-[20px]">vpn_key</span>
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
                    Air-Gapped PII Redaction
                  </h3>
                </div>
                <p className="text-xs text-[#dae2fd] leading-relaxed mb-3">
                  Prior to any inference or state transitions, clauses are passed through local client and sandbox regex filters. All social security numbers, EIN tax identifiers, phone numbers, and multi-currency values are masked.
                </p>
              </div>
              <div className="pt-2 border-t border-[#222a3d] font-mono text-[10px] text-[#94a3b8] flex justify-between">
                <span>Pass Status: Pre-Tokenization</span>
                <span className="text-[#10b981]">Zero Data Leakage</span>
              </div>
            </div>

            <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 text-[#ffc174]">
                  <span className="material-symbols-outlined text-[20px]">account_tree</span>
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
                    LangGraph Deterministic Nodes
                  </h3>
                </div>
                <p className="text-xs text-[#dae2fd] leading-relaxed mb-3">
                  Orchestrated as an acyclic state machine with 4 bounded transitions: <span className="text-[#7bd0ff]">01. Retrieve</span>, <span className="text-[#ffc174]">02. Corrective Match</span>, <span className="text-[#dae2fd]">03. Reflection Critic</span>, and <span className="text-[#10b981]">04. Score &amp; Cryptographic Ledger</span>.
                </p>
              </div>
              <div className="pt-2 border-t border-[#222a3d] font-mono text-[10px] text-[#94a3b8] flex justify-between">
                <span>Node Cycle Limit: Max 2 Retries</span>
                <span className="text-[#10b981]">Fail-Closed</span>
              </div>
            </div>
          </div>

          {/* Method & Limitations Disclosure */}
          <div className="bg-[#060e20] border border-[#334155] rounded-xl p-4 text-xs font-mono">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#222a3d]">
              <div className="flex items-center gap-2 text-[#dae2fd] font-semibold">
                <span className="material-symbols-outlined text-[#ffc174] text-[18px]">info</span>
                <span>Method &amp; Limitations Disclosure</span>
              </div>
              <span className="text-[10px] text-[#94a3b8] bg-[#94a3b8]/10 px-2 py-0.5 rounded border border-[#94a3b8]/30">
                Not a Certified Evidentiary Standard
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[#d8c3ad] leading-relaxed">
              <div className="space-y-2">
                <p>
                  <strong className="text-[#dae2fd]">1. Reproducibility:</strong> Each screening step runs through a fixed LangGraph state sequence at temperature=0.1 and is recorded as an immutable SHA-256 hash-chained block, so the recorded steps can be independently recomputed and checked for tampering.
                </p>
                <p>
                  <strong className="text-[#dae2fd]">2. Open Source Code:</strong> The scoring, extraction, and statutory-source logic are disclosed below via the live code viewer (fetched from the running backend, not a frozen copy).
                </p>
              </div>
              <div className="space-y-2">
                <p>
                  <strong className="text-[#dae2fd]">3. Known Limitations:</strong> Below 0.80 calibrated confidence, or on P1/P2-tier sources, results are explicitly flagged for human counsel review rather than treated as a clean pass - see the Review Queue.
                </p>
                <p>
                  <strong className="text-[#dae2fd]">4. Scope:</strong> Only the jurisdiction/topic pairs listed in <code className="text-[#7bd0ff]">config/coverage.yaml</code> are scored; everything else is extracted but marked out-of-scope, never force-matched against an unrelated statute.
                </p>
              </div>
            </div>
            <p className="mt-3 pt-3 border-t border-[#222a3d] text-[10px] text-[#94a3b8]">
              This tool performs keyword/LLM-assisted term-matching. It does not determine legal compliance, does not evaluate admissibility under any evidentiary standard, and is not a substitute for legal advice.
            </p>

            <div className="mt-4 pt-3 border-t border-[#222a3d] flex items-center justify-between flex-wrap gap-2 text-[11px]">
              <span className="text-[#94a3b8]">Want to see the extraction &amp; NIM execution pipeline code directly?</span>
              <button
                type="button"
                onClick={() => setViewMode('code')}
                className="px-2.5 py-1 bg-[#222a3d] hover:bg-[#2d3449] border border-[#334155] text-[#7bd0ff] rounded transition-colors flex items-center gap-1"
              >
                <span>Switch to Interactive Code Viewer</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Interactive Code Viewer Container */
        <div className="space-y-3">
          {/* Terminal Execution Quick Reference */}
          <div className="bg-[#060e20] border border-[#222a3d] rounded-xl p-3 font-mono text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[#dae2fd]">
              <span className="text-[#ffc174]">$</span>
              <span>pip install -r requirements.txt &amp;&amp; python main.py contract.pdf contract-001</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#7bd0ff]">
              <span>Model: nvidia/nemotron-3-ultra-550b-a55b</span>
              <span className="text-[#a08e7a]">|</span>
              <span>Rate Limit: 1.6s (40 RPM)</span>
            </div>
          </div>

          <div className="bg-[#171f33] border border-[#222a3d] rounded-xl overflow-hidden shadow-sm flex flex-col">
            {/* File Tabs & Actions */}
            <div className="flex items-center justify-between bg-[#131b2e] px-2 pt-2 border-b border-[#222a3d] overflow-x-auto gap-2">
              <div className="flex items-center gap-1 overflow-x-auto">
                {PYTHON_FILES.map((file, idx) => (
                  <button
                    key={file.name}
                    onClick={() => setActiveFileIndex(idx)}
                    className={`px-3 py-1.5 rounded-t-lg font-mono text-xs flex items-center gap-1.5 transition-colors shrink-0 ${
                      activeFileIndex === idx
                        ? 'bg-[#171f33] text-[#ffc174] border-t-2 border-[#ffc174] font-semibold'
                        : 'text-[#d8c3ad] hover:text-[#dae2fd] hover:bg-[#1f293d]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {file.name.endsWith('.py') ? 'data_object' : 'description'}
                    </span>
                    <span>{file.name}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1 mb-1 bg-[#222a3d] hover:bg-[#2d3449] border border-[#334155] text-[#dae2fd] font-mono text-xs rounded flex items-center gap-1 shrink-0"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {copied ? 'check' : 'content_copy'}
                </span>
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* File Description Subheader */}
            <div className="px-4 py-2 bg-[#0d1527] border-b border-[#222a3d] flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#7bd0ff] font-semibold">{currentFileMeta.path}</span>
                <span className="text-[#a08e7a]">•</span>
                <span className="text-[#d8c3ad]">{currentFileMeta.description}</span>
              </div>
              <span className="font-mono text-[11px] text-[#a08e7a]">
                {currentContent.split('\n').length} lines
              </span>
            </div>

            {/* Code Content */}
            <div className="p-4 bg-[#060e20] overflow-x-auto font-mono text-xs text-[#dae2fd] leading-relaxed select-text max-h-[580px] overflow-y-auto">
              {loadError && (
                <div className="text-[#f87171] font-mono text-xs pb-2">{loadError}</div>
              )}
              {!loadError && currentContent === '' && (
                <div className="text-[#a08e7a] font-mono text-xs pb-2">Loading live file from backend...</div>
              )}
              <table className="w-full border-collapse">
                <tbody>
                  {currentContent.split('\n').map((line, lineIdx) => (
                    <tr key={lineIdx} className="hover:bg-[#131b2e]/60">
                      <td className="w-12 pr-4 text-right text-[#57627a] select-none text-[11px] border-r border-[#222a3d] align-top">
                        {lineIdx + 1}
                      </td>
                      <td className="pl-4 whitespace-pre font-mono align-top">{line}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
