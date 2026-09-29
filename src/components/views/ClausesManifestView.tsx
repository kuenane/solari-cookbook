import React, { useState } from 'react';
import { ActiveView, ClauseData } from '../../types';
import { CONTRACT_MANIFEST } from '../../data/mockData';

interface ClausesManifestViewProps {
  onSelectView: (view: ActiveView) => void;
  clauseStatuses: Record<string, string>;
  clauses?: Record<string, ClauseData>;
  contractName?: string;
}

export const ClausesManifestView: React.FC<ClausesManifestViewProps> = ({
  onSelectView,
  clauseStatuses,
  clauses,
  contractName = 'contract-001.pdf',
}) => {
  const [filter, setFilter] = useState<'ALL' | 'FLAGGED' | 'baseline_met' | 'baseline_met'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Use dynamic clauses if available, else static manifest
  const manifestItems = clauses && Object.keys(clauses).length > 0
    ? Object.entries(clauses).map(([key, c]) => ({
        id: c.id,
        number: c.clauseNumber,
        name: c.title,
        topic: c.topic,
        status: clauseStatuses[key] || (c.verdict === 'baseline_met' ? 'Baseline Met' : 'Gaps Flagged'),
        confidence: c.confidence,
        route: key,
        lines: c.lines,
      }))
    : CONTRACT_MANIFEST.map((c) => ({
        ...c,
        status: clauseStatuses[c.route] || c.status,
      }));

  const filteredClauses = manifestItems.filter((c) => {
    const status = c.status;
    const matchesFilter =
      filter === 'ALL'
        ? true
        : filter === 'FLAGGED'
        ? status.toLowerCase().includes('amber') || status.toLowerCase().includes('flagged')
        : filter === 'baseline_met'
        ? status.toLowerCase().includes('verified')
        : status.toLowerCase().includes('passed');

    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.topic.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const flaggedCount = manifestItems.filter((c) => {
    const st = c.status.toLowerCase();
    return st.includes('amber') || st.includes('flagged');
  }).length;

  return (
    <div className="flex flex-col w-full pb-8 space-y-4">
      {/* Top Banner */}
      <div className="bg-[#222a3d] border border-[#334155]/80 rounded-xl p-4 shadow-md flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-base font-semibold text-[#dae2fd] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffc174] text-[20px]">segment</span>
            Clauses Manifest &amp; Inventory — {contractName.split(' ')[0]}
          </h1>
          <p className="text-xs text-[#d8c3ad] mt-0.5">
            Full inventory of {manifestItems.length} extracted statutory provisions, risk classifications, and AST nodes.
          </p>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5">
          {(['ALL', 'FLAGGED', 'baseline_met', 'baseline_met'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded font-mono text-xs font-medium transition-colors ${
                filter === tab
                  ? 'bg-[#f59e0b] text-[#472a00] font-semibold'
                  : 'bg-[#171f33] text-[#d8c3ad] hover:bg-[#222a3d] border border-[#334155]'
              }`}
            >
              {tab === 'FLAGGED' ? `Flagged (${flaggedCount})` : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#d8c3ad] text-[18px]">
          search
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter by clause name, number (§ 1.4), or legal topic..."
          className="w-full bg-[#171f33] border border-[#334155] rounded-xl pl-9 pr-4 py-2 text-xs text-[#dae2fd] focus:border-[#ffc174] focus:outline-none placeholder-[#a08e7a]"
        />
      </div>

      {/* Table */}
      <div className="bg-[#171f33] border border-[#222a3d] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-[#131b2e] text-[#d8c3ad] border-b border-[#222a3d]">
            <tr>
              <th className="p-3">Section</th>
              <th className="p-3">Clause Covenant</th>
              <th className="p-3">Topic Domain</th>
              <th className="p-3">Lines</th>
              <th className="p-3">Classifier Conf</th>
              <th className="p-3">Triage State</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222a3d]">
            {filteredClauses.map((clause) => {
              const currentStatus = clause.status;
              const isAmber = currentStatus.toLowerCase().includes('amber');
              const isVerified = currentStatus.toLowerCase().includes('verified');

              return (
                <tr key={clause.id} className="hover:bg-[#1f293d] transition-colors">
                  <td className="p-3 font-semibold text-[#ffc174]">{clause.number}</td>
                  <td className="p-3 text-[#dae2fd] font-sans font-medium">{clause.name}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-[#060e20] text-[#7bd0ff] text-[10px] border border-[#334155]/60">
                      {clause.topic}
                    </span>
                  </td>
                  <td className="p-3 text-[#d8c3ad]">{clause.lines}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#dae2fd]">
                        {(clause.confidence * 100).toFixed(0)}%
                      </span>
                      <div className="w-16 bg-[#060e20] h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isAmber ? 'bg-[#f59e0b]' : isVerified ? 'bg-[#7bd0ff]' : 'bg-[#10b981]'
                          }`}
                          style={{ width: `${Math.min(clause.confidence * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        isAmber
                          ? 'bg-[#f59e0b]/20 text-[#ffc174] border border-[#f59e0b]/30'
                          : isVerified
                          ? 'bg-[#00a6e0]/20 text-[#7bd0ff] border border-[#7bd0ff]/30'
                          : 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30'
                      }`}
                    >
                      {currentStatus}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectView(clause.route as ActiveView)}
                      className="px-2.5 py-1 bg-[#222a3d] hover:bg-[#2d3449] border border-[#334155] text-[#dae2fd] rounded text-[11px] hover:text-[#ffc174] transition-colors"
                    >
                      Inspect Audit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
