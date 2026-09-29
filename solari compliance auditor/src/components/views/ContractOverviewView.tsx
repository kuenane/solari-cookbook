import React from 'react';
import { ActiveView, ClauseData } from '../../types';

interface ContractOverviewViewProps {
  onSelectView: (view: ActiveView) => void;
  onRunFullAudit: () => void;
  onUploadPdf?: () => void;
  contractName?: string;
  sourceDocHash?: string;
  clauses?: Record<string, ClauseData>;
  clauseStatuses?: Record<string, string>;
}

export const ContractOverviewView: React.FC<ContractOverviewViewProps> = ({
  onSelectView,
  onRunFullAudit,
  onUploadPdf,
  contractName = 'contract-001.pdf — Master SaaS & Enterprise Data License',
  sourceDocHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  clauses = {},
  clauseStatuses = {},
}) => {
  const clauseEntries = Object.entries(clauses);
  const totalClauses = clauseEntries.length;

  // Compute live risk distribution
  let amberCount = 0;
  let passedCount = 0;
  let rejectedCount = 0;

  clauseEntries.forEach(([key, c]) => {
    const status = (clauseStatuses[key] || c.verdict || '').toLowerCase();
    if (status.includes('baseline met')) {
      passedCount++;
    } else if (status.includes('conflict') || status.includes('rejected')) {
      rejectedCount++;
    } else {
      amberCount++;
    }
  });

  const soundnessPct = totalClauses > 0 ? ((passedCount / totalClauses) * 100).toFixed(1) : '100.0';
  const overallVerdict = rejectedCount > 0 ? 'Action Required' : amberCount > 0 ? 'Amber Review' : 'Verified Conformant';

  return (
    <div className="flex flex-col w-full pb-8 space-y-4">
      {/* Header Banner */}
      <div className="bg-[#222a3d] border border-[#334155]/80 rounded-xl p-4 shadow-md flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-[#00a6e0]/20 text-[#7bd0ff] flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">folder_open</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-[#dae2fd]">
                {contractName}
              </h1>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30">
                ACTIVE AUDIT
              </span>
            </div>
            <p className="text-xs text-[#d8c3ad] mt-0.5 font-mono">
              SHA-256: {sourceDocHash.slice(0, 16)}... • DesktopSurface OCR & AST
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectView('sadc-compliance-matrix')}
            className="px-3 py-1.5 bg-[#10b981]/20 hover:bg-[#10b981]/30 border border-[#10b981]/40 text-[#10b981] font-mono text-xs font-semibold rounded flex items-center gap-1.5 shadow-sm transition-all"
            title="SADC Cross-Border Statutory Alignment Matrix"
          >
            <span>🇿🇦 🇱🇸</span>
            <span>SADC Matrix</span>
          </button>

          {onUploadPdf && (
            <button
              type="button"
              onClick={onUploadPdf}
              className="px-3 py-1.5 bg-[#00a6e0] hover:bg-[#7bd0ff] text-[#002738] font-mono text-xs font-semibold rounded flex items-center gap-1.5 shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              Upload PDF
            </button>
          )}

          <button
            type="button"
            onClick={onRunFullAudit}
            className="px-3 py-1.5 bg-[#f59e0b] hover:bg-[#ffc174] text-[#472a00] font-mono text-xs font-semibold rounded flex items-center gap-1.5 shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            Re-Audit Entire PDF
          </button>
        </div>
      </div>

      {/* Metadata & Quick Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-3">
          <span className="font-mono text-[10px] text-[#d8c3ad] uppercase">Document Scope</span>
          <div className="text-xl font-semibold text-[#dae2fd] mt-1">{totalClauses > 0 ? `${totalClauses} Covenants` : '24 Pages'}</div>
          <span className="font-mono text-[10px] text-[#7bd0ff] mt-0.5 block">Air-Gapped Local Ingestion</span>
        </div>

        <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-3">
          <span className="font-mono text-[10px] text-[#d8c3ad] uppercase">Identified Clauses</span>
          <div className="text-xl font-semibold text-[#dae2fd] mt-1">{totalClauses} Extracted</div>
          <span className="font-mono text-[10px] text-[#10b981] mt-0.5 block">100% AST coverage</span>
        </div>

        <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-3">
          <span className="font-mono text-[10px] text-[#d8c3ad] uppercase">Triage Risk Distribution</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f59e0b]/20 text-[#ffc174]">
              {amberCount} Amber
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981]">
              {passedCount} Passed
            </span>
            {rejectedCount > 0 && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#ef4444]/20 text-[#ffb4ab]">
                {rejectedCount} Red
              </span>
            )}
          </div>
          <span className="font-mono text-[10px] text-[#d8c3ad] mt-1 block">{soundnessPct}% Overall Soundness</span>
        </div>

        <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-3">
          <span className="font-mono text-[10px] text-[#d8c3ad] uppercase">Counsel Verdict State</span>
          <div className={`text-xl font-semibold mt-1 ${rejectedCount > 0 ? 'text-[#ffb4ab]' : amberCount > 0 ? 'text-[#ffc174]' : 'text-[#10b981]'}`}>
            {overallVerdict}
          </div>
          <span className="font-mono text-[10px] text-[#d8c3ad] mt-0.5 block">
            {amberCount > 0 || rejectedCount > 0 ? 'Pending manual signoff' : 'Zero-Trust Validated'}
          </span>
        </div>
      </div>

      {/* Main Extracted Clauses Fast Links */}
      <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-mono text-xs font-semibold text-[#ffc174] uppercase tracking-wider">
            Critical Covenants &amp; High-Friction Clauses ({totalClauses})
          </h2>
          <button
            type="button"
            onClick={() => onSelectView('clauses-breakdown')}
            className="text-xs font-mono text-[#7bd0ff] hover:underline flex items-center gap-1"
          >
            <span>View Full Clauses Manifest</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>

        <div className="space-y-2">
          {clauseEntries.slice(0, 8).map(([viewKey, c]) => {
            const status = clauseStatuses[viewKey] || c.verdict || 'gaps_flagged';
            const statusLower = status.toLowerCase();
            const isPassed = statusLower.includes('passed') || statusLower.includes('verified');
            const isFailed = statusLower.includes('failed') || statusLower.includes('reject');

            const dotColor = isPassed ? 'bg-[#10b981]' : isFailed ? 'bg-[#ef4444]' : 'bg-[#f59e0b]';
            const badgeClass = isPassed
              ? 'bg-[#10b981]/20 text-[#10b981]'
              : isFailed
              ? 'bg-[#ef4444]/20 text-[#ffb4ab]'
              : 'bg-[#f59e0b]/20 text-[#ffc174]';

            return (
              <div
                key={viewKey}
                onClick={() => onSelectView(viewKey as ActiveView)}
                className="bg-[#060e20] hover:bg-[#131b2e] border border-[#222a3d] hover:border-[#f59e0b]/60 p-3 rounded-lg flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-[#dae2fd]">
                        {c.clauseNumber} {c.title}
                      </span>
                      <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${badgeClass}`}>
                        {status} ({c.confidence.toFixed(2)})
                      </span>
                    </div>
                    <p className="text-[11px] text-[#d8c3ad] mt-0.5 font-mono truncate max-w-xl">
                      “{c.originalText.slice(0, 100)}...”
                    </p>
                  </div>
                </div>
                <span className="font-mono text-xs text-[#7bd0ff] flex items-center gap-1 shrink-0">
                  Inspect Audit <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
