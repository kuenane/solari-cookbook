import React from 'react';
import { ActiveView } from '../types';

interface HeaderProps {
  onExportPdf: () => void;
  onExportProofBundle?: () => void;
  onRerunAudit: () => void;
  onOverrideVerdict: () => void;
  onUploadPdf?: () => void;
  onResetBenchmark?: () => void;
  overallStatusText: string;
  statusType?: 'amber' | 'green' | 'red';
  contractId?: string;
  clauseId?: string;
  activeView?: ActiveView;
  onSelectView?: (view: ActiveView) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onExportPdf,
  onExportProofBundle,
  onRerunAudit,
  onOverrideVerdict,
  onUploadPdf,
  onResetBenchmark,
  overallStatusText,
  statusType = 'amber',
  contractId = 'contract-001',
  clauseId,
  activeView,
  onSelectView,
}) => {
  const isClauseInspection = activeView?.startsWith('clause-');
  const isContractOverview = activeView === 'contract-overview';

  return (
    <header className="h-14 bg-[#060e20]/95 backdrop-blur-xl border-b border-[#222a3d] shadow-[0_1px_8px_rgba(0,0,0,0.2)] z-20 flex items-center justify-between px-4 shrink-0 gap-4">
      {/* Brand & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          onClick={() => onSelectView && onSelectView('contract-overview')}
          className="flex items-center gap-2 shrink-0 cursor-pointer group"
          title="Return to Contract Overview"
        >
          <span className="font-semibold text-lg text-[#dae2fd] tracking-tight group-hover:text-white transition-colors">
            Solari
          </span>
        </div>

        {/* Dynamic Breadcrumbs */}
        <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-[#d8c3ad] min-w-0 truncate">
          <span className="text-[#334155]">•</span>
          <span
            onClick={() => onSelectView && onSelectView('contract-overview')}
            className="hover:text-white cursor-pointer hover:underline truncate"
          >
            {contractId}
          </span>
          <span className="material-symbols-outlined text-[13px] text-[#64748b]">chevron_right</span>
          {isClauseInspection ? (
            <span className="text-[#ffc174] font-medium flex items-center gap-1">
              <span>Clause Triage</span>
              <span className="text-[#64748b]">/</span>
              <span className="text-[#dae2fd]">{clauseId || 'Inspection'}</span>
            </span>
          ) : isContractOverview ? (
            <span className="text-[#7bd0ff] font-medium">Contract Overview</span>
          ) : (
            <span className="text-[#dae2fd] font-medium capitalize">
              {activeView ? activeView.replace(/-/g, ' ') : 'Audit'}
            </span>
          )}
        </div>

        <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#222a3d] border border-[#334155]/60 text-[#ffc174] font-mono text-[11px] shrink-0">
          <span
            className={`w-2 h-2 rounded-full ${
              statusType === 'green'
                ? 'bg-[#10b981]'
                : statusType === 'red'
                ? 'bg-[#ef4444]'
                : 'bg-[#f59e0b]'
            } animate-pulse`}
          />
          <span className="truncate max-w-[240px]">{overallStatusText}</span>
        </div>
      </div>

      {/* Top Actions: Cleanly divided between Ingestion & Audit Operations */}
      <div className="flex items-center gap-2 shrink-0">
        {onUploadPdf && (
          <button
            onClick={onUploadPdf}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#00a6e0]/15 hover:bg-[#00a6e0]/25 border border-[#00a6e0]/40 text-[#7bd0ff] font-mono text-[11px] font-semibold rounded transition-colors active:scale-95"
            type="button"
            title="Upload new legal agreement PDF"
          >
            <span className="material-symbols-outlined text-[16px]">upload_file</span>
            <span className="hidden md:inline">Upload Contract</span>
          </button>
        )}

        {onResetBenchmark && (
          <button
            onClick={onResetBenchmark}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-[#222a3d]/60 hover:bg-[#222a3d] border border-[#334155]/60 hover:border-[#64748b] text-[#94a3b8] hover:text-[#dae2fd] font-mono text-[11px] rounded transition-colors active:scale-95"
            type="button"
            title="Reset to factory benchmark contract (contract-001.pdf)"
          >
            <span className="material-symbols-outlined text-[15px]">restart_alt</span>
            <span className="hidden xl:inline">Reset Benchmark</span>
          </button>
        )}

        <div className="h-5 w-[1px] bg-[#222a3d] hidden sm:block" />

        <div className="flex items-center gap-1.5">
          {onExportProofBundle && (
            <button
              onClick={onExportProofBundle}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#10b981]/15 hover:bg-[#10b981]/25 border border-[#10b981]/40 text-[#10b981] font-mono text-[11px] font-semibold rounded transition-colors active:scale-95"
              type="button"
              title="Export Tamper-Evident SHA-256 Hash-Chain Proof Bundle (.json)"
            >
              <span className="material-symbols-outlined text-[15px]">verified_user</span>
              <span className="hidden md:inline">Proof Bundle</span>
            </button>
          )}

          <button
            onClick={onExportPdf}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#222a3d] hover:bg-[#2d3449] border border-[#334155] text-[#dae2fd] font-mono text-[11px] rounded transition-colors active:scale-95"
            type="button"
            title="Export Certification PDF"
          >
            <span className="material-symbols-outlined text-[15px] text-[#7bd0ff]">picture_as_pdf</span>
            <span className="hidden lg:inline">Export Report</span>
          </button>

          <button
            onClick={onRerunAudit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#222a3d] hover:bg-[#2d3449] border border-[#334155] text-[#dae2fd] font-mono text-[11px] rounded transition-colors active:scale-95"
            type="button"
            title="Re-run LangGraph Pipeline"
          >
            <span className="material-symbols-outlined text-[15px] text-[#ffc174]">sync</span>
            <span className="hidden lg:inline">Re-run Pipeline</span>
          </button>

          <button
            onClick={onOverrideVerdict}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#f59e0b] hover:bg-[#ffc174] text-[#472a00] font-mono text-[11px] font-semibold rounded transition-colors shadow-sm active:scale-95"
            type="button"
            title="Override Counsel Evaluation"
          >
            <span className="material-symbols-outlined text-[15px]">rule</span>
            <span className="hidden sm:inline">Override Verdict</span>
          </button>
        </div>

        <div className="flex items-center gap-2 pl-2 border-l border-[#222a3d]">
          <div
            className="w-7 h-7 rounded-full bg-[#ffc174] flex items-center justify-center cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
            title="Counsel Session: lebohang.kuenane44@gmail.com"
          >
            <span className="material-symbols-outlined text-[#472a00] text-[16px]">person</span>
          </div>
        </div>
      </div>
    </header>
  );
};
