import React, { useState } from 'react';
import { ClauseData } from '../../types';
import { verdictLabel } from '../../utils/verdict';
import { RedlineEditorModal } from '../modals/RedlineEditorModal';

interface ClauseAuditViewProps {
  clause: ClauseData;
  onApproveCaveat: (clauseId: string, notes?: string) => void;
  onOverridePass: (clauseId: string) => void;
  onApplyRedline?: (clauseId: string, revisedText: string, reason: string) => void;
  onRejectRevision: (clauseId: string, reason?: string) => void;
  onRerunClassifier: (clauseId: string) => void;
  onOpenJsonModal: () => void;
  onOpenOverrideModal?: () => void;
  isRerunning?: boolean;
  contractName?: string;
}

export const ClauseAuditView: React.FC<ClauseAuditViewProps> = ({
  clause,
  onApproveCaveat,
  onOverridePass,
  onApplyRedline,
  onRejectRevision,
  onRerunClassifier,
  onOpenJsonModal,
  onOpenOverrideModal,
  isRerunning = false,
  contractName = 'contract-001',
}) => {
  const [selectedNodeModal, setSelectedNodeModal] = useState<string | null>(null);
  const [isRedlineModalOpen, setIsRedlineModalOpen] = useState<boolean>(false);

  // Confidence gauge calculation
  const circumference = 125.6; // 2 * pi * 20
  const strokeDashoffset = circumference - clause.confidence * circumference;

  const isAmber = clause.verdict === 'gaps_flagged';
  const isPassed = clause.verdict === 'baseline_met';
  const isRejected = clause.verdict === 'conflict_or_absent';

  return (
    <div className="flex flex-col w-full pb-8">
      {/* Top Banner / Verdict Ribbon */}
      <div className="relative overflow-hidden bg-[#222a3d] border border-[#334155]/80 rounded-xl p-3 mb-3 shadow-md">
        <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-[#f59e0b]/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                isAmber
                  ? 'bg-[#f59e0b]/20 text-[#ffc174]'
                  : isPassed
                  ? 'bg-[#10b981]/20 text-[#10b981]'
                  : 'bg-[#ef4444]/20 text-[#ef4444]'
              }`}
            >
              <span className="material-symbols-outlined text-[24px]">
                {isAmber ? 'warning' : isPassed ? 'check_circle' : 'cancel'}
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`font-mono text-xs font-semibold uppercase tracking-wider ${
                    isAmber
                      ? 'text-[#ffc174]'
                      : isPassed
                      ? 'text-[#7bd0ff]'
                      : 'text-[#ffb4ab]'
                  }`}
                >
                  {clause.verdictLabel}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#f59e0b]/30 text-[#ffddb8] font-mono text-[10px]">
                  {clause.confidence >= 0.8 ? 'High Confidence' : 'Moderate Confidence'}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#2d3449] text-[#d8c3ad] font-mono text-[10px]">
                  {clause.reflection.soundness ? 'Sound Formulation' : 'Ambiguity Detected'}
                </span>
              </div>
              <p className="text-xs text-[#d8c3ad] truncate mt-0.5">
                {isAmber
                  ? `Confidence score ${clause.confidence.toFixed(2)} falls below the critical threshold (${clause.targetThreshold.toFixed(2)}). Manual remediation or override verification required prior to execution.`
                  : isPassed
                  ? `Confidence score ${clause.confidence.toFixed(2)} meets rigorous statutory compliance targets. No remediation covenants required.`
                  : `Clause exhibits critical statutory non-compliance and falls below sound risk tolerances.`}
              </p>
            </div>
          </div>

          {/* Meta Identifiers */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <span className="font-mono text-xs text-[#d8c3ad] bg-[#060e20] px-2.5 py-1 rounded border border-[#334155]/60 truncate max-w-[200px]" title={contractName}>
              CONTRACT: <span className="text-[#dae2fd] font-semibold">{contractName.split(' ')[0]}</span>
            </span>
            <span className="font-mono text-xs text-[#d8c3ad] bg-[#060e20] px-2.5 py-1 rounded border border-[#334155]/60">
              CLAUSE: <span className="text-[#ffc174] font-semibold">{clause.id}</span>
            </span>
            {clause.jurisdictions && clause.jurisdictions.length > 1 ? (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#10b981] bg-[#10b981]/15 px-2.5 py-1 rounded border border-[#10b981]/30 font-semibold" title="Bilateral Multi-Sovereign Evaluation">
                <span className="material-symbols-outlined text-[14px]">compare_arrows</span>
                {clause.jurisdictions.map((j) => (j === 'ZA' ? '🇿🇦 RSA' : j === 'LS' ? '🇱🇸 Lesotho' : j)).join(' ↔ ')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#7bd0ff] bg-[#060e20] px-2.5 py-1 rounded border border-[#334155]/60">
                <span className="material-symbols-outlined text-[14px]">public</span> {clause.jurisdiction}
              </span>
            )}
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#ffb95f] bg-[#060e20] px-2.5 py-1 rounded border border-[#334155]/60">
              <span className="material-symbols-outlined text-[14px]">shield</span> {clause.topic}
            </span>
          </div>
        </div>
      </div>

      {/* Dual Sovereign Multi-Jurisdiction Cross-Walk Box (if applicable) */}
      {clause.dualSovereignAudit && (
        <div className="bg-[#171f33] border-l-4 border-[#10b981] border-y border-r border-[#222a3d] rounded-xl p-3 mb-3 shadow-md">
          <div className="flex items-center justify-between pb-2 border-b border-[#222a3d] mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🇿🇦 🇱🇸</span>
              <span className="font-mono text-xs font-semibold text-[#10b981] uppercase tracking-wider">
                Bilateral Sovereign Dual-Audit: SADC Harmonization
              </span>
            </div>
            <span className={`font-mono text-[10px] px-2 py-0.5 rounded font-semibold ${
              clause.dualSovereignAudit.bilateralHarmonizationVerdict === 'ALIGNED'
                ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30'
                : 'bg-[#f59e0b]/20 text-[#ffc174] border border-[#f59e0b]/30'
            }`}>
              {clause.dualSovereignAudit.bilateralHarmonizationVerdict === 'ALIGNED' ? 'BILATERAL SAFE HARBOR CONFIRMED' : 'REVISION RECOMMENDED'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
            {/* Primary Statute */}
            <div className="bg-[#0b1326] p-2.5 rounded-lg border border-[#334155]/60">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-[#7bd0ff]">
                  {clause.dualSovereignAudit.primaryStatute.jurisdiction === 'ZA' ? '🇿🇦 South Africa (Primary)' : '🇱🇸 Kingdom of Lesotho (Primary)'}
                </span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  clause.dualSovereignAudit.primaryStatute.status === 'CONFORMANT' ? 'text-[#10b981]' : 'text-[#ffc174]'
                }`}>
                  {clause.dualSovereignAudit.primaryStatute.status} ({(clause.dualSovereignAudit.primaryStatute.verdictScore * 100).toFixed(0)}%)
                </span>
              </div>
              <div className="text-[11px] text-[#dae2fd]">{clause.dualSovereignAudit.primaryStatute.regulation}</div>
              <p className="text-[10px] text-[#94a3b8] mt-1 italic">{clause.dualSovereignAudit.primaryStatute.citation}</p>
            </div>

            {/* Secondary Statute */}
            <div className="bg-[#0b1326] p-2.5 rounded-lg border border-[#334155]/60">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-[#ffc174]">
                  {clause.dualSovereignAudit.secondaryStatute.jurisdiction === 'ZA' ? '🇿🇦 South Africa (Reciprocal)' : '🇱🇸 Kingdom of Lesotho (Reciprocal)'}
                </span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  clause.dualSovereignAudit.secondaryStatute.status === 'CONFORMANT' ? 'text-[#10b981]' : 'text-[#ffc174]'
                }`}>
                  {clause.dualSovereignAudit.secondaryStatute.status} ({(clause.dualSovereignAudit.secondaryStatute.verdictScore * 100).toFixed(0)}%)
                </span>
              </div>
              <div className="text-[11px] text-[#dae2fd]">{clause.dualSovereignAudit.secondaryStatute.regulation}</div>
              <p className="text-[10px] text-[#94a3b8] mt-1 italic">{clause.dualSovereignAudit.secondaryStatute.citation}</p>
            </div>
          </div>
        </div>
      )}

      {/* 4-Stage Audit Pipeline Stepper */}
      <div className="bg-[#131b2e] border border-[#222a3d] rounded-xl p-3 mb-3 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-[#222a3d]/60 mb-2">
          <span className="font-mono text-[11px] text-[#d8c3ad] uppercase tracking-wider">
            Deterministic Pipeline Timeline
          </span>
          <div className="flex items-center gap-2">
            {isRerunning && (
              <span className="font-mono text-[10px] text-[#ffc174] animate-pulse flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px] animate-spin">refresh</span>
                Executing LangGraph Nodes...
              </span>
            )}
            <span className="font-mono text-[11px] text-[#d8c3ad]">4 / 4 Nodes Evaluated</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {/* Stage 1: RETRIEVE */}
          <div
            onClick={() => setSelectedNodeModal('01. RETRIEVE')}
            className="bg-[#171f33] hover:bg-[#1f283e] transition-colors cursor-pointer rounded-lg p-2.5 flex flex-col justify-between border border-[#334155]/60"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[11px] text-[#d8c3ad]">01. RETRIEVE</span>
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#7bd0ff] bg-[#222a3d] px-1.5 py-0.5 rounded">
                <span className="material-symbols-outlined text-[12px]">check_circle</span> Fetched
              </span>
            </div>
            <div className="font-mono text-xs text-[#dae2fd] truncate font-medium">
              {clause.pipelineStages.retrieve.source}
            </div>
            <div className="font-mono text-[11px] text-[#d8c3ad] truncate mt-1">
              {clause.pipelineStages.retrieve.regulation}
            </div>
          </div>

          {/* Stage 2: MATCH */}
          <div
            onClick={() => setSelectedNodeModal('02. MATCH')}
            className="bg-[#171f33] hover:bg-[#1f283e] transition-colors cursor-pointer rounded-lg p-2.5 flex flex-col justify-between border border-[#334155]/60"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[11px] text-[#d8c3ad]">02. MATCH</span>
              <span
                className={`inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded ${
                  clause.pipelineStages.match.status === 'Warning'
                    ? 'text-[#ffc174] bg-[#f59e0b]/20'
                    : 'text-[#7bd0ff] bg-[#00a6e0]/20'
                }`}
              >
                <span className="material-symbols-outlined text-[12px]">
                  {clause.pipelineStages.match.status === 'Warning' ? 'warning' : 'check_circle'}
                </span>
                {clause.pipelineStages.match.status}
              </span>
            </div>
            <div className="flex items-center justify-between font-mono text-xs text-[#dae2fd]">
              <span>Match: {clause.pipelineStages.match.matched ? 'true' : 'false'}</span>
              <span className="text-[#ffc174] font-semibold">
                Conf: {clause.pipelineStages.match.confidence.toFixed(2)}
              </span>
            </div>
            <div className="font-mono text-[11px] text-[#d8c3ad] truncate mt-1">
              Model: {clause.pipelineStages.match.model}
            </div>
          </div>

          {/* Stage 3: REFLECT */}
          <div
            onClick={() => setSelectedNodeModal('03. REFLECT')}
            className="bg-[#171f33] hover:bg-[#1f283e] transition-colors cursor-pointer rounded-lg p-2.5 flex flex-col justify-between border border-[#334155]/60"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[11px] text-[#d8c3ad]">03. REFLECT</span>
              <span
                className={`inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded ${
                  clause.pipelineStages.reflect.soundness
                    ? 'text-[#10b981] bg-[#10b981]/20'
                    : 'text-[#ffb4ab] bg-[#93000a]/40'
                }`}
              >
                <span className="material-symbols-outlined text-[12px]">
                  {clause.pipelineStages.reflect.soundness ? 'check_circle' : 'cancel'}
                </span>
                {clause.pipelineStages.reflect.status}
              </span>
            </div>
            <div
              className={`font-mono text-xs font-medium ${
                clause.pipelineStages.reflect.soundness ? 'text-[#10b981]' : 'text-[#ffb4ab]'
              }`}
            >
              Soundness: {clause.pipelineStages.reflect.soundness ? 'true' : 'false'}
            </div>
            <div className="font-mono text-[11px] text-[#d8c3ad] truncate mt-1">
              {clause.pipelineStages.reflect.notes}
            </div>
          </div>

          {/* Stage 4: SCORE */}
          <div
            onClick={() => setSelectedNodeModal('04. SCORE')}
            className="bg-[#222a3d] hover:bg-[#283247] transition-colors cursor-pointer rounded-lg p-2.5 flex flex-col justify-between border border-[#ffc174]/40"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[11px] text-[#d8c3ad]">04. SCORE</span>
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#ffc174] bg-[#f59e0b]/30 px-1.5 py-0.5 rounded font-semibold">
                {clause.pipelineStages.score.status}
              </span>
            </div>
            <div
              className={`font-semibold text-lg ${
                isAmber ? 'text-[#ffc174]' : isPassed ? 'text-[#7bd0ff]' : 'text-[#ffb4ab]'
              }`}
            >
              {verdictLabel(clause.verdict)}
            </div>
            <div className="font-mono text-[11px] text-[#d8c3ad] truncate mt-1">
              {clause.pipelineStages.score.actionRequired}
            </div>
          </div>
        </div>
      </div>

      {/* Telemetry Row: 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        {/* Card 1: Confidence Gauge */}
        <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] text-[#d8c3ad] uppercase tracking-wider">
              Classification Confidence
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl text-[#ffc174] font-semibold">
                {(clause.confidence * 100).toFixed(1)}%
              </span>
              <span className="font-mono text-[11px] text-[#ffb4ab]">
                ({clause.variance >= 0 ? '+' : ''}{(clause.variance * 100).toFixed(1)}%)
              </span>
            </div>
            <span className="font-mono text-[10px] text-[#d8c3ad] mt-1">
              Acceptance Target: ≥{(clause.targetThreshold * 100).toFixed(1)}%
            </span>
          </div>

          <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
              <circle
                className="text-[#2d3449]"
                cx="24"
                cy="24"
                fill="transparent"
                r="20"
                stroke="currentColor"
                strokeWidth="4"
              />
              <circle
                className={isAmber ? 'text-[#ffc174]' : isPassed ? 'text-[#10b981]' : 'text-[#ef4444]'}
                cx="24"
                cy="24"
                fill="transparent"
                r="20"
                stroke="currentColor"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                strokeWidth="4"
              />
            </svg>
            <span className="absolute font-mono text-xs text-[#dae2fd] font-semibold">
              {clause.confidence.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Card 2: Acceptance Delta */}
        <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-3 flex flex-col justify-between shadow-sm">
          <span className="font-mono text-[10px] text-[#d8c3ad] uppercase tracking-wider">
            Threshold Variance
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-2xl font-semibold ${
                clause.variance < 0 ? 'text-[#ffb4ab]' : 'text-[#10b981]'
              }`}
            >
              {clause.variance > 0 ? `+${clause.variance.toFixed(3)}` : clause.variance.toFixed(3)}
            </span>
            <span className="font-mono text-[11px] text-[#d8c3ad]">
              {clause.variance < 0 ? 'Below Sound Limit' : 'Exceeds Baseline'}
            </span>
          </div>
          <div className="w-full bg-[#222a3d] h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                clause.variance < 0 ? 'bg-[#ffc174]' : 'bg-[#10b981]'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, clause.confidence * 100))}%` }}
            />
          </div>
          <div className="flex justify-between font-mono text-[10px] text-[#d8c3ad] mt-1">
            <span>0.00</span>
            <span className="text-[#ffc174]">{clause.confidence.toFixed(2)}</span>
            <span className="text-[#dae2fd]">Target {clause.targetThreshold.toFixed(2)}</span>
          </div>
        </div>

        {/* Card 3: Execution Latency */}
        <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-3 flex flex-col justify-between shadow-sm">
          <span className="font-mono text-[10px] text-[#d8c3ad] uppercase tracking-wider">
            Inference Telemetry
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl text-[#7bd0ff] font-semibold">{clause.latencyMs}</span>
            <span className="font-mono text-xs text-[#d8c3ad]">ms</span>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px] text-[#d8c3ad] mt-2">
            <span>
              Retries: <span className="text-[#dae2fd] font-semibold">{clause.retries}</span>
            </span>
            <span>
              Tokens: <span className="text-[#dae2fd] font-semibold">{clause.tokens}</span>
            </span>
          </div>
        </div>

        {/* Card 4: Classifier Engine Info */}
        <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-3 flex flex-col justify-between shadow-sm">
          <span className="font-mono text-[10px] text-[#d8c3ad] uppercase tracking-wider">
            Engine Verification
          </span>
          <div className="text-sm text-[#dae2fd] font-medium truncate mt-1">
            {clause.model}
          </div>
          <div className="flex items-center justify-between font-mono text-[11px] text-[#d8c3ad] mt-2">
            <span className="inline-flex items-center gap-1 text-[#7bd0ff]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7bd0ff]" />
              Temperature {clause.temperature}
            </span>
            <span className="font-mono text-[10px] text-[#d8c3ad] px-1 py-0.5 bg-[#222a3d] rounded border border-[#334155]">
              AST-PARSED
            </span>
          </div>
        </div>
      </div>

      {/* Primary Legal Workspace: Dual-Pane Inspection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-3">
        {/* Left Pane: Clause Source & Marked Text (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Clause Source Card */}
          <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 mb-2 bg-[#131b2e] -mx-3 -mt-3 px-3 pt-3 rounded-t-xl border-b border-[#222a3d]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#ffc174]">description</span>
                <span className="font-mono text-xs text-[#dae2fd] font-semibold">
                  Contract Clause Under Audit
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#222a3d] text-[#d8c3ad] border border-[#334155]/60">
                  {clause.lines}
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#f59e0b]/20 text-[#ffc174] border border-[#f59e0b]/30">
                  {clause.pipelineStages.score.status}
                </span>
              </div>
            </div>

            {/* Document Snippet */}
            <div className="bg-[#060e20] p-3 rounded-lg font-mono text-xs text-[#dae2fd] leading-relaxed relative border border-[#222a3d]">
              <div className="text-[#d8c3ad] select-none mb-1 font-mono text-[11px] font-semibold">
                {clause.title.toUpperCase()} OBLIGATION
              </div>
              <p className="text-[#dae2fd]">
                “The parties agree to{' '}
                <mark className="bg-[#f59e0b]/30 text-[#ffddb8] px-1 py-0.5 rounded font-semibold not-italic border border-[#f59e0b]/40">
                  {clause.highlightedText}
                </mark>
                .”
              </p>
              <div className="mt-2 pt-1 border-t border-[#222a3d] flex items-center justify-between text-[#d8c3ad] font-mono text-[10px]">
                <span className="flex items-center gap-1 text-[#ffc174]">
                  <span className="material-symbols-outlined text-[14px]">priority_high</span>
                  Marked segment lacks defined statutory regimes, retention limits, or breach notices.
                </span>
                <span>Length: {clause.lengthChars} chars</span>
              </div>
            </div>
          </div>

          {/* Benchmark Comparative Viewer (Side-by-side) */}
          <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222a3d]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#7bd0ff]">balance</span>
                <span className="font-mono text-xs text-[#dae2fd] font-semibold">
                  Regulatory Alignment Differential
                </span>
              </div>
              <a
                className="font-mono text-[10px] text-[#7bd0ff] hover:text-[#c4e7ff] flex items-center gap-1 transition-colors hover:underline"
                href={clause.differential.benchmarkUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span>{clause.differential.benchmarkTitle}</span>
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {/* Clause Excerpt */}
              <div className="bg-[#060e20] p-2.5 rounded-lg flex flex-col border border-[#222a3d]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] text-[#d8c3ad] uppercase">
                    Current Contract Clause
                  </span>
                  <span className="font-mono text-[10px] text-[#ffb4ab]">
                    {clause.differential.currentClauseEvaluation}
                  </span>
                </div>
                <div className="bg-[#222a3d]/40 p-1.5 rounded font-mono text-[11px] text-[#dae2fd] leading-snug">
                  {clause.differential.currentClauseExcerpt}
                </div>
                <div className="mt-1.5 text-[#d8c3ad] text-[11px] leading-relaxed">
                  {clause.differential.currentClauseDefects}
                </div>
              </div>

              {/* FTC Enforcement Benchmark Excerpt */}
              <div className="bg-[#060e20] p-2.5 rounded-lg flex flex-col border border-[#222a3d]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] text-[#d8c3ad] uppercase">
                    FTC Enforcement Benchmark
                  </span>
                  <span className="font-mono text-[10px] text-[#7bd0ff]">Target Standard</span>
                </div>
                <div className="bg-[#222a3d]/40 p-1.5 rounded font-mono text-[11px] text-[#7bd0ff] leading-snug">
                  {clause.differential.benchmarkExcerpt}
                </div>
                <div className="mt-1.5 text-[#d8c3ad] text-[11px] leading-relaxed">
                  {clause.differential.benchmarkStandard}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Pane: Reflection Engine Analysis & Rule Telemetry (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Reflection Engine Card */}
          <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222a3d]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#ffc174]">psychology</span>
                <span className="font-mono text-xs text-[#dae2fd] font-semibold">
                  Reflection Engine Evaluation
                </span>
              </div>
              <span
                className={`inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  clause.reflection.soundness
                    ? 'bg-[#10b981]/20 text-[#10b981]'
                    : 'bg-[#93000a]/40 text-[#ffb4ab]'
                }`}
              >
                <span className="material-symbols-outlined text-[12px]">
                  {clause.reflection.soundness ? 'check_circle' : 'cancel'}
                </span>
                Soundness = {clause.reflection.soundness ? 'True' : 'False'}
              </span>
            </div>

            <div className="bg-[#060e20] p-3 rounded-lg space-y-2 border border-[#222a3d]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[#d8c3ad]">Reflection Finding</span>
                <span
                  className={`font-mono text-[10px] font-semibold ${
                    clause.reflection.soundness ? 'text-[#10b981]' : 'text-[#ffc174]'
                  }`}
                >
                  {clause.reflection.findingTitle}
                </span>
              </div>

              <div className="bg-[#222a3d]/50 p-2 rounded text-xs text-[#dae2fd] leading-relaxed font-sans border border-[#334155]/60">
                {clause.reflection.critique}
              </div>

              <div className="flex flex-col gap-1 pt-1 font-mono text-[11px] text-[#d8c3ad] border-t border-[#222a3d]">
                <div className="flex items-center justify-between">
                  <span>Ambiguity Penalty:</span>
                  <span
                    className={`font-mono ${
                      clause.reflection.ambiguityPenalty < 0 ? 'text-[#ffb4ab]' : 'text-[#10b981]'
                    }`}
                  >
                    {clause.reflection.ambiguityPenalty.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Jurisdictional Specificity:</span>
                  <span className="font-mono text-[#ffc174]">
                    {clause.reflection.jurisdictionalSpecificity}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Semantic Drift Risk:</span>
                  <span
                    className={`font-mono ${
                      clause.reflection.semanticDriftRisk === 'Low'
                        ? 'text-[#10b981]'
                        : clause.reflection.semanticDriftRisk === 'Moderate'
                        ? 'text-[#ffc174]'
                        : 'text-[#ffb4ab]'
                    }`}
                  >
                    {clause.reflection.semanticDriftRisk}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Regulatory Citation & Safe Harbor Details */}
          <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between pb-1 mb-1 border-b border-[#222a3d]">
              <span className="font-mono text-xs text-[#dae2fd] font-semibold">
                Regulatory Reference Vector
              </span>
              <span className="font-mono text-[10px] text-[#d8c3ad]">
                {clause.referenceVector.vectorId}
              </span>
            </div>

            <div className="bg-[#060e20] p-2.5 rounded-lg space-y-1.5 font-mono text-[11px] border border-[#222a3d]">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[#d8c3ad] text-[10px]">ENDPOINT:</span>
                <span className="text-[#7bd0ff] text-[10px] truncate text-right">
                  {clause.referenceVector.endpoint}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#d8c3ad] text-[10px]">SAFE HARBOR:</span>
                <span
                  className={`text-[10px] font-semibold ${
                    clause.referenceVector.safeHarbor === 'SATISFIED'
                      ? 'text-[#10b981]'
                      : 'text-[#ffb4ab]'
                  }`}
                >
                  {clause.referenceVector.safeHarbor}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#d8c3ad] text-[10px]">MANDATORY CLAUSES:</span>
                <span className="text-[#dae2fd] text-[10px] truncate max-w-[200px]">
                  {clause.referenceVector.mandatoryClauses}
                </span>
              </div>
            </div>

            {/* Cryptographic Ledger Block Stamp */}
            <div className="mt-2.5 pt-2 border-t border-[#222a3d] flex items-center justify-between text-[10px] font-mono">
              <span className="inline-flex items-center gap-1 text-[#10b981]">
                <span className="material-symbols-outlined text-[12px]">lock</span>
                SHA-256 Block: {clause.cryptographicReceipt ? clause.cryptographicReceipt.blockHash.slice(0, 14) : 'e3b0c44298fc1c'}...
              </span>
              <span className="text-[#7bd0ff] bg-[#00a6e0]/10 px-1.5 py-0.5 rounded border border-[#7bd0ff]/30">
                Non-Repudiation Anchored
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Action Bar for Compliance Counsel */}
      <div className="bg-[#222a3d] border border-[#334155]/80 rounded-xl p-3 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#ffc174] text-[20px]">verified_user</span>
          <span className="font-mono text-xs text-[#dae2fd] font-semibold">
            Counsel Triage Actions:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Action: Approve with Caveat */}
          <button
            type="button"
            onClick={() => onApproveCaveat(clause.id)}
            className="px-3 py-1.5 rounded bg-[#ffc174] text-[#472a00] font-mono text-xs font-semibold hover:bg-[#f59e0b] transition-colors flex items-center gap-1 shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">check_box</span>
            <span>Approve with Caveat</span>
          </button>

          {/* Action: Override & Pass */}
          <button
            type="button"
            onClick={() => onOverridePass(clause.id)}
            className="px-3 py-1.5 rounded bg-[#060e20] hover:bg-[#171f33] border border-[#334155] text-[#7bd0ff] font-mono text-xs font-medium transition-colors flex items-center gap-1 active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span>Override &amp; Pass</span>
          </button>

          {/* Action: Reject / Require Revision */}
          <button
            type="button"
            onClick={() => onRejectRevision(clause.id)}
            className="px-3 py-1.5 rounded bg-[#93000a]/40 hover:bg-[#93000a]/60 border border-[#ef4444]/40 text-[#ffb4ab] font-mono text-xs font-medium transition-colors flex items-center gap-1 active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">block</span>
            <span>Reject / Require Revision</span>
          </button>

          {/* Action: Live Redline Interactive Editor */}
          {onApplyRedline && (
            <button
              type="button"
              onClick={() => setIsRedlineModalOpen(true)}
              className="px-3 py-1.5 rounded bg-[#10b981]/20 hover:bg-[#10b981]/30 border border-[#10b981]/60 text-[#10b981] font-mono text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Open Live Redline Editor to replace defective text with statutory safe-harbor covenant"
            >
              <span className="material-symbols-outlined text-[16px]">edit_note</span>
              <span>Live Redline Diff</span>
            </button>
          )}

          {/* Action: Authenticated Sign-Off & Bar Attestation */}
          {onOpenOverrideModal && (
            <button
              type="button"
              onClick={onOpenOverrideModal}
              className="px-3 py-1.5 rounded bg-[#f59e0b]/20 hover:bg-[#f59e0b]/30 border border-[#f59e0b]/50 text-[#ffc174] font-mono text-xs font-medium transition-colors flex items-center gap-1 active:scale-95"
              title="Open Bar Attestation Dialog & Commit Counsel Signature to Ledger"
            >
              <span className="material-symbols-outlined text-[16px]">edit_document</span>
              <span>Bar Attestation &amp; Sign-off</span>
            </button>
          )}

          {/* Action: Re-run Classifier */}
          <button
            type="button"
            onClick={() => onRerunClassifier(clause.id)}
            disabled={isRerunning}
            className="px-3 py-1.5 rounded bg-[#171f33] hover:bg-[#2d3449] border border-[#334155] text-[#dae2fd] font-mono text-xs font-medium transition-colors flex items-center gap-1 active:scale-95 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${isRerunning ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{isRerunning ? 'Running...' : 'Re-run Classifier'}</span>
          </button>

          {/* Action: View/Download Raw JSON */}
          <button
            type="button"
            onClick={onOpenJsonModal}
            className="px-3 py-1.5 rounded bg-[#171f33] hover:bg-[#2d3449] border border-[#334155] text-[#d8c3ad] hover:text-[#dae2fd] font-mono text-xs font-medium transition-colors flex items-center gap-1 active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">code</span>
            <span>Raw JSON Payload</span>
          </button>
        </div>
      </div>

      {/* Node Detail Popup */}
      {selectedNodeModal && (
        <div className="fixed inset-0 z-50 bg-[#060e20]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#171f33] border border-[#334155] rounded-xl max-w-md w-full p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#222a3d]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#ffc174] text-[18px]">account_tree</span>
                <span className="font-mono text-xs text-[#dae2fd] font-semibold">
                  LangGraph Node: {selectedNodeModal}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNodeModal(null)}
                className="text-[#d8c3ad] hover:text-[#dae2fd]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="py-3 font-mono text-xs text-[#d8c3ad] space-y-2">
              <p>
                <span className="text-[#7bd0ff]">Function:</span>{' '}
                {selectedNodeModal.includes('RETRIEVE')
                  ? 'retrieve_regulations(state: ClauseState)'
                  : selectedNodeModal.includes('MATCH')
                  ? 'corrective_match(state: ClauseState)'
                  : selectedNodeModal.includes('REFLECT')
                  ? 'reflect(state: ClauseState)'
                  : 'score(state: ClauseState)'}
              </p>
              <p>
                <span className="text-[#7bd0ff]">Execution Surface:</span>{' '}
                {selectedNodeModal.includes('RETRIEVE')
                  ? 'BrowserSurface (stealth scraper)'
                  : selectedNodeModal.includes('MATCH')
                  ? 'SandboxSurface (LLM sandbox isolated)'
                  : selectedNodeModal.includes('REFLECT')
                  ? 'SandboxSurface (Reflection critic)'
                  : 'SandboxSurface -> DesktopSurface (log write)'}
              </p>
              <p>
                <span className="text-[#7bd0ff]">Current State Payload:</span>
              </p>
              <pre className="bg-[#060e20] p-2 rounded text-[11px] text-[#ffc174] overflow-x-auto border border-[#222a3d]">
                {JSON.stringify(
                  selectedNodeModal.includes('RETRIEVE')
                    ? clause.pipelineStages.retrieve
                    : selectedNodeModal.includes('MATCH')
                    ? clause.pipelineStages.match
                    : selectedNodeModal.includes('REFLECT')
                    ? clause.pipelineStages.reflect
                    : clause.pipelineStages.score,
                  null,
                  2
                )}
              </pre>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedNodeModal(null)}
                className="px-3 py-1 bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] font-mono text-xs rounded"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Redline Diff Modal */}
      {onApplyRedline && (
        <RedlineEditorModal
          isOpen={isRedlineModalOpen}
          onClose={() => setIsRedlineModalOpen(false)}
          clause={clause}
          onApplyRedline={onApplyRedline}
        />
      )}
    </div>
  );
};
