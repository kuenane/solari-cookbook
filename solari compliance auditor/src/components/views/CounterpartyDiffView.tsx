import React, { useState } from 'react';
import { ClauseData } from '../../types';

interface CounterpartyDiffViewProps {
  currentClauses: ClauseData[];
  contractName: string;
  onApplyUnifiedRedline?: (clauseId: string, revisedText: string, reason: string) => void;
}

interface CounterpartyMarkupClause {
  clauseNumber: string;
  title: string;
  originalText: string;
  counterpartyText: string;
  statusChange: 'REGRESSION' | 'NEUTRAL' | 'IMPROVEMENT';
  originalScore: number;
  newScore: number;
  issueFlag: string;
  statutoryImpact: string;
}

export const CounterpartyDiffView: React.FC<CounterpartyDiffViewProps> = ({
  currentClauses,
  contractName,
  onApplyUnifiedRedline,
}) => {
  const [selectedClauseIndex, setSelectedClauseIndex] = useState<number>(0);
  const [filter, setFilter] = useState<'all' | 'regressions'>('all');

  // Realistic counterparty markup comparison cases
  const diffItems: CounterpartyMarkupClause[] = [
    {
      clauseNumber: '§ 4.1',
      title: 'Transborder Flow & Telemetry Mandate',
      originalText: `Customer authorizes the cross-border transfer of communications and telemetry data from the Kingdom of Lesotho to designated cloud facilities in the Republic of South Africa, on the condition that Service Provider maintains adequate technical safeguards complying with Section 24 of the Lesotho Data Protection Act 2012 and Section 72 of POPIA 2013. Service Provider covenants to notify Customer within forty-eight (48) hours of any security compromise.`,
      counterpartyText: `Customer authorizes the unrestricted cross-border transfer of communications and telemetry data to global data centers. Service Provider shall endeavor to provide notice of any security compromise as soon as commercially practicable.`,
      statusChange: 'REGRESSION',
      originalScore: 0.94,
      newScore: 0.58,
      issueFlag: 'Deleted SADC adequacy covenant & replaced 48h notice with vague standard.',
      statutoryImpact: 'Violates Lesotho DPA 2012 § 24 and POPIA § 72 transborder flow restrictions.',
    },
    {
      clauseNumber: '§ 5.2',
      title: 'Operator Security Measures & Breach Indemnity',
      originalText: `Service Provider shall act as an Operator under POPIA 2013, implementing appropriate, reasonable technical and organizational security measures pursuant to POPIA Section 19. Service Provider provides full indemnity for direct regulatory fines imposed by the Information Regulator resulting from Operator willful neglect.`,
      counterpartyText: `Service Provider shall process personal data using reasonable measures. Any regulatory fines shall be subject to the standard aggregate liability cap of twelve (12) months fees.`,
      statusChange: 'REGRESSION',
      originalScore: 0.89,
      newScore: 0.62,
      issueFlag: 'Capped statutory fine indemnity under commercial fee limit.',
      statutoryImpact: 'Severe regulatory risk transfer; exposes Responsible Party to statutory liability.',
    },
    {
      clauseNumber: '§ 1.1',
      title: 'Technical Safeguards & Encryption Standards',
      originalText: `Service Provider covenants to implement AES-256 encryption at rest and TLS 1.3 in transit consistent with NIST SP 800-53 and FTC 16 CFR § 314.4.`,
      counterpartyText: `Service Provider covenants to implement industry-standard AES-256 encryption at rest and TLS 1.3 in transit consistent with NIST SP 800-53 and FTC 16 CFR § 314.4.`,
      statusChange: 'NEUTRAL',
      originalScore: 0.96,
      newScore: 0.96,
      issueFlag: 'Minor stylistic addition ("industry-standard"); no substantive legal drift.',
      statutoryImpact: 'Complies with mandatory technical encryption benchmarks.',
    },
    {
      clauseNumber: '§ 2.4',
      title: 'Subprocessor Authorization & Audit Rights',
      originalText: `Service Provider shall not engage any subprocessor without prior written notice to Customer. Customer retains the right to conduct an annual security audit upon thirty (30) days notice.`,
      counterpartyText: `Service Provider shall provide thirty (30) days prior written notice before onboarding any new subprocessor. Customer or its designated independent auditor may inspect security certifications and SOC 2 Type II reports annually.`,
      statusChange: 'IMPROVEMENT',
      originalScore: 0.88,
      newScore: 0.95,
      issueFlag: 'Enhanced subprocessor notice and specified independent SOC 2 Type II audit trail.',
      statutoryImpact: 'Strengthens GDPR Art. 28(3) and POPIA Operator oversight conformity.',
    },
  ];

  const filteredItems = filter === 'regressions'
    ? diffItems.filter((item) => item.statusChange === 'REGRESSION')
    : diffItems;

  const currentDiff = filteredItems[selectedClauseIndex] || filteredItems[0];

  return (
    <div className="flex flex-col w-full pb-8 space-y-4 font-mono">
      {/* Header */}
      <div className="bg-[#171f33] border border-[#334155] rounded-xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#ffc174]/20 text-[#ffc174] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">difference</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#dae2fd] uppercase tracking-wider">
                Counterparty Redline Triage &amp; Risk Drift Analyzer
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#222a3d] text-[#7bd0ff] border border-[#334155]">
                Version A (Baseline) vs Version B (Counterparty Markup)
              </span>
            </div>
            <p className="text-xs text-[#d8c3ad] mt-0.5">
              Automated statutory degradation detection: highlights where opposing counsel revisions violate safe-harbor standards.
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#060e20] p-1 rounded-lg border border-[#334155]">
          <button
            type="button"
            onClick={() => { setFilter('all'); setSelectedClauseIndex(0); }}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              filter === 'all'
                ? 'bg-[#222a3d] text-[#dae2fd] font-bold'
                : 'text-[#94a3b8] hover:text-[#dae2fd]'
            }`}
          >
            All Provisions ({diffItems.length})
          </button>
          <button
            type="button"
            onClick={() => { setFilter('regressions'); setSelectedClauseIndex(0); }}
            className={`px-3 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
              filter === 'regressions'
                ? 'bg-[#ef4444]/20 border border-[#ef4444]/60 text-[#ffb4ab] font-bold'
                : 'text-[#94a3b8] hover:text-[#ffb4ab]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#ef4444]"></span>
            <span>Regressions Only (2)</span>
          </button>
        </div>
      </div>

      {/* Main Diff Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Clause List */}
        <div className="lg:col-span-4 space-y-2">
          <span className="text-[10px] text-[#94a3b8] uppercase tracking-wider block font-semibold px-1">
            Detected Covenants ({filteredItems.length})
          </span>
          <div className="space-y-1.5">
            {filteredItems.map((item, idx) => {
              const isSelected = idx === selectedClauseIndex;
              return (
                <div
                  key={item.clauseNumber}
                  onClick={() => setSelectedClauseIndex(idx)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#1f293d] border-[#7bd0ff] shadow-md'
                      : 'bg-[#171f33] border-[#334155] hover:border-[#7bd0ff]/50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-[#dae2fd]">{item.clauseNumber}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        item.statusChange === 'REGRESSION'
                          ? 'bg-[#ef4444]/20 text-[#ffb4ab]'
                          : item.statusChange === 'IMPROVEMENT'
                          ? 'bg-[#10b981]/20 text-[#10b981]'
                          : 'bg-[#334155] text-[#94a3b8]'
                      }`}
                    >
                      {item.statusChange === 'REGRESSION' ? '▼ RISK REGRESSION' : item.statusChange === 'IMPROVEMENT' ? '▲ IMPROVEMENT' : '■ NEUTRAL'}
                    </span>
                  </div>
                  <div className="text-xs text-[#d8c3ad] truncate">{item.title}</div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-[#94a3b8]">
                    <span>Score: {(item.originalScore * 100).toFixed(0)}% → {(item.newScore * 100).toFixed(0)}%</span>
                    <span className={item.newScore < item.originalScore ? 'text-[#ef4444]' : 'text-[#10b981]'}>
                      {(item.newScore - item.originalScore) > 0 ? `+${((item.newScore - item.originalScore) * 100).toFixed(0)}%` : `${((item.newScore - item.originalScore) * 100).toFixed(0)}%`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Comparative Inspection */}
        {currentDiff && (
          <div className="lg:col-span-8 bg-[#171f33] border border-[#334155] rounded-xl p-4 shadow-sm space-y-4">
            {/* Header info */}
            <div className="flex items-center justify-between pb-3 border-b border-[#222a3d]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#dae2fd] text-sm">{currentDiff.clauseNumber} — {currentDiff.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      currentDiff.statusChange === 'REGRESSION'
                        ? 'bg-[#ef4444]/20 text-[#ffb4ab]'
                        : 'bg-[#10b981]/20 text-[#10b981]'
                    }`}
                  >
                    {currentDiff.statusChange}
                  </span>
                </div>
                <div className="text-xs text-[#ef4444] mt-1 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  <span>{currentDiff.issueFlag}</span>
                </div>
              </div>

              {/* Confidence Drift Indicator */}
              <div className="text-right">
                <div className="text-[10px] text-[#94a3b8]">Confidence Drift</div>
                <div className="text-sm font-bold">
                  <span className="text-[#10b981]">{(currentDiff.originalScore * 100).toFixed(0)}%</span>
                  <span className="text-[#94a3b8] mx-1">→</span>
                  <span className={currentDiff.newScore < 0.7 ? 'text-[#ef4444]' : 'text-[#10b981]'}>
                    {(currentDiff.newScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Side-by-side text diff */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Baseline Version A */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-[#10b981] uppercase font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Version A: Your Baseline (Safe Harbor)
                </span>
                <div className="p-3 bg-[#060e20] border border-[#10b981]/30 rounded-lg text-[#dae2fd] text-[11px] leading-relaxed h-48 overflow-y-auto">
                  {currentDiff.originalText}
                </div>
              </div>

              {/* Counterparty Markup Version B */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-[#ffb4ab] uppercase font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  Version B: Counterparty Redline Markup
                </span>
                <div className="p-3 bg-[#060e20] border border-[#ef4444]/40 rounded-lg text-[#ffb4ab] text-[11px] leading-relaxed h-48 overflow-y-auto">
                  {currentDiff.counterpartyText}
                </div>
              </div>
            </div>

            {/* Statutory Exposure Callout */}
            <div className="p-3 rounded-lg bg-[#0b1326] border border-[#334155] text-xs space-y-1">
              <span className="text-[#ffc174] font-bold block flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">gavel</span>
                Statutory Defense Evaluation:
              </span>
              <p className="text-[#d8c3ad] text-[11px] leading-relaxed">
                {currentDiff.statutoryImpact}
              </p>
            </div>

            {/* Counsel Recommendation & Rejection Action */}
            <div className="flex items-center justify-between pt-2 border-t border-[#222a3d]">
              <span className="text-[10px] text-[#94a3b8]">
                Recommended Action: Reject counterparty dilution; revert to baseline safe-harbor covenant.
              </span>

              {onApplyUnifiedRedline && (
                <button
                  type="button"
                  onClick={() =>
                    onApplyUnifiedRedline(
                      currentDiff.clauseNumber,
                      currentDiff.originalText,
                      `Reverted counterparty markup dilution: ${currentDiff.issueFlag}`
                    )
                  }
                  className="px-3 py-1.5 rounded bg-[#10b981] hover:bg-[#059669] text-[#062c1d] font-bold text-xs transition-all shadow-sm flex items-center gap-1 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[14px]">undo</span>
                  <span>Revert to Safe-Harbor Baseline</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
