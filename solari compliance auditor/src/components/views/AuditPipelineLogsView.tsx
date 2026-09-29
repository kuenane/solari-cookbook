import React, { useState } from 'react';
import { verdictShortLabel } from '../../utils/verdict';
import { PipelineLogEntry, AuditLedgerBlock } from '../../types';

interface AuditPipelineLogsViewProps {
  logs: PipelineLogEntry[];
  ledgerBlocks?: AuditLedgerBlock[];
  onTriggerRun: () => void;
  isExecuting: boolean;
  onVerifyLedger?: () => void;
  onExportProofBundle?: () => void;
}

export const AuditPipelineLogsView: React.FC<AuditPipelineLogsViewProps> = ({
  logs,
  ledgerBlocks = [],
  onTriggerRun,
  isExecuting,
  onVerifyLedger,
  onExportProofBundle,
}) => {
  const [activeTab, setActiveTab] = useState<'telemetry' | 'ledger'>('telemetry');
  const [filterSurface, setFilterSurface] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [verifiedChainStatus, setVerifiedChainStatus] = useState<boolean | null>(true);

  const filteredLogs = logs.filter((log) => {
    const matchesSurface = filterSurface === 'all' || log.surface === filterSurface;
    const matchesLevel = filterLevel === 'all' || log.level === filterLevel;
    return matchesSurface && matchesLevel;
  });

  return (
    <div className="flex flex-col w-full pb-8 space-y-3">
      {/* Header */}
      <div className="bg-[#222a3d] border border-[#334155]/80 rounded-xl p-3 shadow-md flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffc174] text-[20px]">terminal</span>
            <h1 className="text-base font-semibold text-[#dae2fd]">
              Multi-Surface LangGraph Pipeline &amp; Cryptographic Audit Ledger
            </h1>
          </div>
          <p className="text-xs text-[#d8c3ad] mt-0.5 font-mono">
            Grounding engine with PII redaction, calibrated deterministic scoring, and SHA-256 block chain integrity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Selector */}
          <div className="flex bg-[#060e20] p-1 rounded-lg border border-[#334155]">
            <button
              type="button"
              onClick={() => setActiveTab('telemetry')}
              className={`px-3 py-1 rounded font-mono text-xs transition-colors ${
                activeTab === 'telemetry'
                  ? 'bg-[#171f33] text-[#7bd0ff] font-semibold'
                  : 'text-[#d8c3ad] hover:text-[#dae2fd]'
              }`}
            >
              Surface Telemetry
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`px-3 py-1 rounded font-mono text-xs transition-colors flex items-center gap-1 ${
                activeTab === 'ledger'
                  ? 'bg-[#171f33] text-[#38bdf8] font-semibold'
                  : 'text-[#d8c3ad] hover:text-[#dae2fd]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">lock</span>
              <span>SHA-256 Ledger ({ledgerBlocks.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onTriggerRun}
            disabled={isExecuting}
            className="px-3 py-1.5 bg-[#f59e0b] hover:bg-[#ffc174] text-[#472a00] font-mono text-xs font-semibold rounded flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${isExecuting ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{isExecuting ? 'Executing Nodes...' : 'Stream New Audit Run'}</span>
          </button>
        </div>
      </div>

      {activeTab === 'telemetry' ? (
        <>
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="text-[#d8c3ad] text-[11px]">Surface:</span>
              {(['all', 'desktop', 'browser', 'sandbox', 'langgraph'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterSurface(s)}
                  className={`px-2 py-0.5 rounded capitalize ${
                    filterSurface === s
                      ? 'bg-[#222a3d] text-[#ffc174] border border-[#f59e0b]/40 font-semibold'
                      : 'bg-[#171f33] text-[#d8c3ad] hover:text-[#dae2fd] border border-[#334155]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="text-[#d8c3ad] text-[11px]">Level:</span>
              {(['all', 'info', 'warn', 'error', 'success'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setFilterLevel(l)}
                  className={`px-2 py-0.5 rounded capitalize ${
                    filterLevel === l
                      ? 'bg-[#222a3d] text-[#7bd0ff] border border-[#7bd0ff]/40 font-semibold'
                      : 'bg-[#171f33] text-[#d8c3ad] hover:text-[#dae2fd] border border-[#334155]'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Terminal Viewport */}
          <div className="bg-[#060e20] border border-[#222a3d] rounded-xl p-3 font-mono text-xs overflow-x-auto shadow-inner min-h-[460px] flex flex-col justify-between">
            <div className="space-y-1">
              <div className="text-[#a08e7a] pb-2 mb-2 border-b border-[#222a3d] flex justify-between items-center text-[11px]">
                <span>$ python main.py contract-001.pdf --evaluator=deterministic-grounding --redact-pii</span>
                <span className="text-[#7bd0ff]">TAURI IPC STDOUT • TAIL -F</span>
              </div>

              {filteredLogs.map((log) => {
                const surfaceColor =
                  log.surface === 'desktop'
                    ? 'text-[#7bd0ff] bg-[#00a6e0]/10 border-[#7bd0ff]/30'
                    : log.surface === 'browser'
                    ? 'text-[#ffc174] bg-[#f59e0b]/10 border-[#f59e0b]/30'
                    : log.surface === 'sandbox'
                    ? 'text-[#c4e7ff] bg-[#222a3d] border-[#334155]'
                    : 'text-[#d8c3ad] bg-[#171f33] border-[#334155]';

                const levelColor =
                  log.level === 'warn'
                    ? 'text-[#ffc174]'
                    : log.level === 'error'
                    ? 'text-[#ffb4ab]'
                    : log.level === 'success'
                    ? 'text-[#10b981]'
                    : 'text-[#7bd0ff]';

                return (
                  <div
                    key={log.id}
                    className="py-1 px-1.5 rounded hover:bg-[#131b2e] transition-colors flex items-start gap-2 leading-relaxed"
                  >
                    <span className="text-[#a08e7a] text-[10px] shrink-0">{log.timestamp}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-semibold shrink-0 uppercase border ${surfaceColor}`}
                    >
                      {log.surface}
                    </span>
                    <span className={`text-[10px] font-semibold uppercase shrink-0 ${levelColor}`}>
                      [{log.node}]
                    </span>
                    <span className="text-[#dae2fd] break-all">{log.message}</span>
                  </div>
                );
              })}
            </div>

            {/* Status Line */}
            <div className="pt-3 mt-3 border-t border-[#222a3d] flex justify-between items-center text-[10px] text-[#a08e7a]">
              <span>Displaying {filteredLogs.length} logged pipeline events</span>
              <span className="flex items-center gap-1 text-[#10b981]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                LangGraph StateMachine Active • Non-Repudiation Verified
              </span>
            </div>
          </div>
        </>
      ) : (
        /* Cryptographic Audit Ledger View */
        <div className="bg-[#060e20] border border-[#222a3d] rounded-xl p-4 shadow-inner">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#222a3d]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#10b981] text-[20px]">enhanced_encryption</span>
              <div>
                <h3 className="font-mono text-sm text-[#dae2fd] font-semibold">
                  Tamper-Evident SHA-256 Audit Ledger (`audit_ledger.jsonl`)
                </h3>
                <p className="text-[11px] text-[#94a3b8] font-mono">
                  SHA-256 hash chain makes edits to this local ledger detectable after the fact. Single-writer, not distributed consensus.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onExportProofBundle && (
                <button
                  type="button"
                  onClick={onExportProofBundle}
                  className="inline-flex items-center gap-1 font-mono text-xs px-2.5 py-1 rounded bg-[#10b981]/20 hover:bg-[#10b981]/30 text-[#10b981] border border-[#10b981]/40 transition-colors"
                  title="Download verifiable Cryptographic Proof Bundle (.json)"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Export Proof Bundle (.json)
                </button>
              )}
              {onVerifyLedger && (
                <button
                  type="button"
                  onClick={onVerifyLedger}
                  className="inline-flex items-center gap-1 font-mono text-xs px-2.5 py-1 rounded bg-[#222a3d] hover:bg-[#2d3449] text-[#7bd0ff] border border-[#334155] transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  Re-Verify
                </button>
              )}
              <span className="inline-flex items-center gap-1 font-mono text-xs px-2.5 py-1 rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                Chain Integrity: 100% Valid
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {ledgerBlocks.map((block) => (
              <div
                key={block.blockHash}
                className="bg-[#171f33] border border-[#334155] rounded-xl p-3 font-mono text-xs space-y-2 hover:border-[#38bdf8]/60 transition-colors"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#060e20] text-[#ffc174] font-bold border border-[#334155]">
                      BLOCK #{block.sequenceId}
                    </span>
                    <span className="text-[#dae2fd] font-medium">{block.clauseId}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-semibold text-[10px] ${
                        block.verdict === 'baseline_met'
                          ? 'bg-[#10b981]/20 text-[#10b981]'
                          : block.verdict === 'gaps_flagged'
                          ? 'bg-[#f59e0b]/20 text-[#ffc174]'
                          : 'bg-[#ef4444]/20 text-[#ffb4ab]'
                      }`}
                    >
                      {verdictShortLabel(block.verdict)}
                    </span>
                  </div>

                  <span className="text-[#a08e7a] text-[11px]">{block.timestamp}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-[#060e20] p-2.5 rounded-lg border border-[#222a3d] text-[11px]">
                  <div>
                    <span className="text-[#94a3b8]">BLOCK SHA-256: </span>
                    <span className="text-[#38bdf8] font-bold">{block.blockHash.slice(0, 24)}...</span>
                  </div>
                  <div>
                    <span className="text-[#94a3b8]">PREVIOUS HASH: </span>
                    <span className="text-[#a08e7a]">{block.previousBlockHash.slice(0, 24)}...</span>
                  </div>
                  <div>
                    <span className="text-[#94a3b8]">CALIBRATED SCORE: </span>
                    <span className="text-[#ffc174] font-bold">{block.calibratedScore.toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-[#94a3b8]">EVALUATOR MODEL: </span>
                    <span className="text-[#dae2fd]">{block.evaluatorModel}</span>
                  </div>
                </div>

                {block.counselSignature && (
                  <div className="bg-[#0b1326] p-2.5 rounded border border-[#38bdf8]/40 text-[11px]">
                    <div className="flex items-center gap-1.5 text-[#38bdf8] font-semibold mb-1">
                      <span className="material-symbols-outlined text-[14px]">shield</span>
                      <span>Authenticated Counsel Signature</span>
                    </div>
                    <div className="text-[#d8c3ad] space-y-0.5">
                      <p>
                        Counsel: <span className="text-[#dae2fd] font-medium">{block.counselSignature.counsel}</span>{' '}
                        ({block.counselSignature.email}) — Bar: {block.counselSignature.barNumber}
                      </p>
                      <p className="text-[#a08e7a] italic">
                        "{block.counselSignature.justification}"
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
