import React, { useEffect, useState } from 'react';
import { fetchReviewQueue, ReviewQueueItem } from '../../api/complianceClient';
import { verdictShortLabel, verdictColorClasses } from '../../utils/verdict';

interface ReviewQueueViewProps {
  onSelectClause?: (clauseId: string) => void;
}

/**
 * Phase 0 fix: "flags clauses for human counsel review" needs to be a real,
 * persistent, visible list - not just a per-clause override modal buried in
 * a detail view that's easy to silently ignore forever. This view lists
 * every clause the backend currently considers flagged_for_counsel and not
 * yet resolved by an override (see GET /api/review-queue in server.py).
 */
export const ReviewQueueView: React.FC<ReviewQueueViewProps> = ({ onSelectClause }) => {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchReviewQueue();
      setItems(result);
    } catch (e) {
      setError('Could not reach the backend review queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#dae2fd] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffc174]">flag</span>
            Review Queue
          </h2>
          <p className="text-xs text-[#94a3b8] font-mono mt-1">
            Every clause flagged as gaps_flagged or conflict_or_absent, not yet resolved by a counsel override.
            This list is server-authoritative - see GET /api/review-queue.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="px-3 py-1.5 bg-[#222a3d] hover:bg-[#334155] border border-[#334155] text-[#dae2fd] font-mono text-xs rounded flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[15px]">refresh</span>
          Refresh
        </button>
      </div>

      {loading && (
        <div className="text-[#94a3b8] font-mono text-xs">Loading review queue...</div>
      )}

      {error && (
        <div className="text-[#f87171] font-mono text-xs bg-[#f87171]/10 border border-[#f87171]/30 rounded-lg p-3">
          {error} (Is the FastAPI backend running on port 8000?)
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="text-[#10b981] font-mono text-xs bg-[#10b981]/10 border border-[#10b981]/30 rounded-lg p-4">
          Nothing pending. Every flagged clause has been resolved by a counsel override.
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="border border-[#334155] rounded-lg overflow-hidden">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#1f293d] text-[#d8c3ad] border-b border-[#334155]">
              <tr>
                <th className="p-2">Clause</th>
                <th className="p-2">Contract</th>
                <th className="p-2">Coverage</th>
                <th className="p-2">Flagged At</th>
                <th className="p-2">Ledger Block</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222a3d]">
              {items.map((item) => (
                <tr key={item.clause_id} className="hover:bg-[#171f33]">
                  <td className="p-2 font-semibold text-[#dae2fd]">{item.clause_id}</td>
                  <td className="p-2 text-[#94a3b8]">{item.contract_id}</td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] border ${verdictColorClasses(item.status)}`}>
                      {verdictShortLabel(item.status)}
                    </span>
                  </td>
                  <td className="p-2 text-[#94a3b8]">{new Date(item.flagged_at).toLocaleString()}</td>
                  <td className="p-2 text-[#7bd0ff] truncate max-w-[140px]">{item.block_hash}</td>
                  <td className="p-2">
                    {onSelectClause && (
                      <button
                        type="button"
                        onClick={() => onSelectClause(item.clause_id)}
                        className="text-[#7bd0ff] hover:underline"
                      >
                        Open &rarr;
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
