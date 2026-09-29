import React from 'react';
import { ActiveView, ClauseData } from '../types';

interface SidebarProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  clauseStatuses: Record<string, string>;
  clauses?: Record<string, ClauseData>;
  onUploadPdf?: () => void;
  onVerifyLedger?: () => void;
  isVerifyingLedger?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  clauseStatuses,
  clauses = {},
  onUploadPdf,
  onVerifyLedger,
  isVerifyingLedger = false,
}) => {
  const clauseEntries = Object.entries(clauses);
  const totalClausesCount = clauseEntries.length;
  const flaggedCount = clauseEntries.filter(([k, c]) => {
    const st = (clauseStatuses[k] || c.verdict || '').toLowerCase();
    return st.includes('amber') || st.includes('flagged') || st.includes('review');
  }).length;

  return (
    <aside className="w-64 shrink-0 bg-[#131b2e] border-r border-[#222a3d] flex flex-col justify-between overflow-hidden select-none h-full z-30">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between bg-[#060e20] border-b border-[#222a3d]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffc174] text-[20px]">gavel</span>
            <span className="font-mono text-xs text-[#dae2fd] uppercase tracking-wider font-semibold">
              Navigation
            </span>
          </div>
          {onUploadPdf && (
            <button
              type="button"
              onClick={onUploadPdf}
              className="p-1 rounded hover:bg-[#222a3d] text-[#7bd0ff] transition-colors"
              title="Upload new contract PDF"
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
            </button>
          )}
        </div>

        {/* Scrollable Nav Area */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {/* Document Ingestion & Root */}
          <div className="flex flex-col gap-1.5">
            {onUploadPdf && (
              <button
                type="button"
                onClick={onUploadPdf}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#00a6e0]/15 hover:bg-[#00a6e0]/25 border border-[#00a6e0]/40 text-[#7bd0ff] rounded-lg font-mono text-xs font-semibold transition-all active:scale-[0.98] shadow-sm mb-1"
              >
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                <span>Upload New Contract</span>
              </button>
            )}

            <span className="px-2 font-mono text-[11px] text-[#d8c3ad] uppercase tracking-wider">
              Document Root
            </span>
            <nav className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => onSelectView('contract-overview')}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                  activeView === 'contract-overview'
                    ? 'bg-[#222a3d] text-[#dae2fd] font-semibold border-l-2 border-[#ffc174]'
                    : 'text-[#d8c3ad] hover:bg-[#171f33] hover:text-[#dae2fd]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">description</span>
                <span className="text-xs truncate">Contract Overview</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectView('clauses-breakdown')}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-left transition-colors ${
                  activeView === 'clauses-breakdown'
                    ? 'bg-[#222a3d] text-[#dae2fd] font-semibold border-l-2 border-[#ffc174]'
                    : 'text-[#d8c3ad] hover:bg-[#171f33] hover:text-[#dae2fd]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="material-symbols-outlined text-[18px]">segment</span>
                  <span className="text-xs truncate">Clauses Manifest</span>
                </div>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#222a3d] text-[#ffc174] font-medium">
                  {flaggedCount} flagged
                </span>
              </button>
            </nav>
          </div>

          {/* Dynamic Clause Triage Navigation */}
          <div className="flex flex-col gap-1">
            <div className="px-2 flex items-center justify-between">
              <span className="font-mono text-[11px] text-[#d8c3ad] uppercase tracking-wider">
                Clause Triage
              </span>
              <span className="font-mono text-[10px] text-[#64748b]">
                {totalClausesCount} total
              </span>
            </div>
            
            <div className="flex flex-col gap-1 pl-1">
              {clauseEntries.map(([viewKey, clause]) => {
                const status = clauseStatuses[viewKey] || clause.verdict || 'gaps_flagged';
                const statusLower = status.toLowerCase();
                const isPassed = statusLower.includes('passed') || statusLower.includes('verified');
                const isFailed = statusLower.includes('failed') || statusLower.includes('reject');
                const isSelected = activeView === viewKey || activeView.replace('-audit', '') === viewKey.replace('-audit', '');

                const dotColor = isPassed
                  ? 'bg-[#10b981]'
                  : isFailed
                  ? 'bg-[#ef4444]'
                  : 'bg-[#f59e0b]';

                const badgeBg = isPassed
                  ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30'
                  : isFailed
                  ? 'bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30'
                  : 'bg-[#2d3449] text-[#ffc174]';

                return (
                  <button
                    key={viewKey}
                    type="button"
                    onClick={() => onSelectView(viewKey)}
                    className={`flex items-center justify-between px-2 py-1.5 rounded transition-colors text-left ${
                      isSelected
                        ? 'bg-[#222a3d] text-[#dae2fd] border-l-2 border-[#f59e0b] font-medium'
                        : 'text-[#d8c3ad] hover:bg-[#171f33] hover:text-[#dae2fd]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
                      <span className="font-mono text-xs truncate" title={`${clause.clauseNumber} ${clause.title}`}>
                        {clause.clauseNumber} {clause.title.slice(0, 16)}
                      </span>
                    </div>
                    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${badgeBg} truncate max-w-[75px]`}>
                      {status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compliance Repos */}
          <div className="flex flex-col gap-1">
            <span className="px-2 font-mono text-[11px] text-[#d8c3ad] uppercase tracking-wider">
              Compliance Repos
            </span>
            <nav className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => onSelectView('regulatory-ftc')}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                  activeView === 'regulatory-ftc'
                    ? 'bg-[#222a3d] text-[#dae2fd] font-semibold border-l-2 border-[#7bd0ff]'
                    : 'text-[#d8c3ad] hover:bg-[#171f33] hover:text-[#dae2fd]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] text-[#7bd0ff]">policy</span>
                <span className="text-xs truncate">FTC Safeguards Rule</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectView('regulatory-gdpr')}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                  activeView === 'regulatory-gdpr'
                    ? 'bg-[#222a3d] text-[#dae2fd] font-semibold border-l-2 border-[#7bd0ff]'
                    : 'text-[#d8c3ad] hover:bg-[#171f33] hover:text-[#dae2fd]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] text-[#7bd0ff]">verified_user</span>
                <span className="text-xs truncate">GDPR Art 28 Standard</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectView('regulatory-ccpa')}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                  activeView === 'regulatory-ccpa'
                    ? 'bg-[#222a3d] text-[#dae2fd] font-semibold border-l-2 border-[#7bd0ff]'
                    : 'text-[#d8c3ad] hover:bg-[#171f33] hover:text-[#dae2fd]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] text-[#7bd0ff]">shield</span>
                <span className="text-xs truncate">CCPA § 1798.140</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectView('regulatory-popia')}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                  activeView === 'regulatory-popia'
                    ? 'bg-[#222a3d] text-[#dae2fd] font-semibold border-l-2 border-[#10b981]'
                    : 'text-[#d8c3ad] hover:bg-[#171f33] hover:text-[#dae2fd]'
                }`}
                title="South Africa Protection of Personal Information Act (POPIA 2013)"
              >
                <span className="text-[14px]">🇿🇦</span>
                <span className="text-xs truncate">SA POPIA Act 4/2013</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectView('regulatory-lesotho-dpa')}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                  activeView === 'regulatory-lesotho-dpa'
                    ? 'bg-[#222a3d] text-[#dae2fd] font-semibold border-l-2 border-[#ffc174]'
                    : 'text-[#d8c3ad] hover:bg-[#171f33] hover:text-[#dae2fd]'
                }`}
                title="Kingdom of Lesotho Data Protection Act 2012 & Communications Act"
              >
                <span className="text-[14px]">🇱🇸</span>
                <span className="text-xs truncate">Lesotho DPA 2012</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectView('review-queue')}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                  activeView === 'review-queue'
                    ? 'bg-[#222a3d] text-[#dae2fd] font-semibold border-l-2 border-[#10b981]'
                    : 'text-[#d8c3ad] hover:bg-[#171f33] hover:text-[#dae2fd]'
                }`}
                title="Every clause flagged for counsel review, not yet resolved (server-authoritative)"
              >
                <span className="material-symbols-outlined text-[16px] text-[#10b981]">flag</span>
                <span className="text-xs truncate font-semibold text-[#10b981]">Review Queue</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectView('counterparty-diff')}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                  activeView === 'counterparty-diff'
                    ? 'bg-[#222a3d] text-[#dae2fd] font-semibold border-l-2 border-[#ffc174]'
                    : 'text-[#d8c3ad] hover:bg-[#171f33] hover:text-[#dae2fd]'
                }`}
                title="Counterparty Redline Triage: Automated Version Drift & Statutory Risk Degradation"
              >
                <span className="material-symbols-outlined text-[16px] text-[#ffc174]">difference</span>
                <span className="text-xs truncate font-semibold text-[#ffc174]">Counterparty Diff</span>
              </button>
            </nav>
          </div>

          {/* Infrastructure & Pipeline */}
          <div className="flex flex-col gap-1">
            <span className="px-2 font-mono text-[11px] text-[#d8c3ad] uppercase tracking-wider">
              Pipeline &amp; Cryptography
            </span>
            <nav className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => onSelectView('merkle-visualizer')}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                  activeView === 'merkle-visualizer'
                    ? 'bg-[#222a3d] text-[#dae2fd] font-semibold border-l-2 border-[#7bd0ff]'
                    : 'text-[#d8c3ad] hover:bg-[#171f33] hover:text-[#dae2fd]'
                }`}
                title="Interactive hash chain view: block-by-block linkage and tamper testing"
              >
                <span className="material-symbols-outlined text-[16px] text-[#7bd0ff]">account_tree</span>
                <span className="text-xs truncate font-semibold text-[#7bd0ff]">Hash Chain View</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectView('audit-pipeline-logs')}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                  activeView === 'audit-pipeline-logs'
                    ? 'bg-[#222a3d] text-[#dae2fd] font-semibold border-l-2 border-[#ffc174]'
                    : 'text-[#d8c3ad] hover:bg-[#171f33] hover:text-[#dae2fd]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] text-[#ffc174]">terminal</span>
                <span className="text-xs truncate">Audit Pipeline Logs</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectView('python-source')}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                  activeView === 'python-source'
                    ? 'bg-[#222a3d] text-[#dae2fd] font-semibold border-l-2 border-[#7bd0ff]'
                    : 'text-[#d8c3ad] hover:bg-[#171f33] hover:text-[#dae2fd]'
                }`}
                title="Forensic Algorithmic Disclosures, Mathematical Bounds & Execution Specs"
              >
                <span className="material-symbols-outlined text-[16px] text-[#7bd0ff]">fact_check</span>
                <span className="text-xs truncate">Algorithmic Audit Spec</span>
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Footer System Status & Ledger Verification Action */}
      <div className="p-3 bg-[#060e20] border-t border-[#222a3d] flex flex-col gap-2">
        {onVerifyLedger && (
          <button
            type="button"
            onClick={onVerifyLedger}
            disabled={isVerifyingLedger}
            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#222a3d] hover:bg-[#2d3449] border border-[#334155] text-[#7bd0ff] rounded font-mono text-[11px] transition-colors disabled:opacity-50"
            title="Recompute and verify the SHA-256 hash chain"
          >
            <span className={`material-symbols-outlined text-[14px] ${isVerifyingLedger ? 'animate-spin' : ''}`}>
              {isVerifyingLedger ? 'refresh' : 'verified'}
            </span>
            <span>{isVerifyingLedger ? 'Verifying...' : 'Verify Cryptographic Chain'}</span>
          </button>
        )}

        <div className="flex items-center justify-between font-mono text-[10px] text-[#d8c3ad]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <span>NVIDIA NIM Engine</span>
          </div>
          <span className="text-[#ffc174]">v3.2.0</span>
        </div>
        <div className="font-mono text-[9px] text-[#64748b] truncate">
          SHA-256 Hash-Chain Ledger
        </div>
      </div>
    </aside>
  );
};
