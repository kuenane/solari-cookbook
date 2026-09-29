import React, { useState } from 'react';
import { ClauseData } from '../../types';

interface JsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  clause: ClauseData;
}

export const JsonModal: React.FC<JsonModalProps> = ({ isOpen, onClose, clause }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const payload = {
    audit_version: "v4.18.2-ast",
    timestamp: new Date().toISOString(),
    contract_id: "contract-001",
    clause_id: clause.id,
    topic: clause.topic,
    jurisdiction: clause.jurisdiction,
    clause_text: clause.originalText,
    match_result: {
      match: clause.pipelineStages.match.matched,
      confidence: clause.confidence,
      threshold_required: clause.targetThreshold,
      variance: clause.variance,
      model: clause.model,
    },
    reflection_engine: {
      soundness: clause.reflection.soundness,
      flag: clause.reflection.soundness ? "SOUND_VERIFIED" : "AMBIGUITY_DETECTED",
      notes: clause.reflection.critique,
      ambiguity_penalty: clause.reflection.ambiguityPenalty,
      jurisdictional_specificity: clause.reflection.jurisdictionalSpecificity,
      semantic_drift_risk: clause.reflection.semanticDriftRisk,
    },
    benchmark: {
      authority: clause.differential.benchmarkTitle,
      source_url: clause.differential.benchmarkUrl,
      directive: clause.pipelineStages.retrieve.regulation,
      excerpt: clause.differential.benchmarkExcerpt,
    },
    verdict: {
      tier: clause.verdict,
      human_review_required: clause.verdict === 'gaps_flagged',
      suggested_action: clause.pipelineStages.score.actionRequired,
    },
    triage_history: clause.triageHistory || [],
  };

  const jsonString = JSON.stringify(payload, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `audit_contract-001_${clause.id}.json`);
    dlAnchorElem.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060e20]/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#222a3d] border border-[#334155] rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 py-2.5 bg-[#2d3449] border-b border-[#334155] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7bd0ff] text-[18px]">terminal</span>
            <span className="font-mono text-xs text-[#dae2fd] font-semibold">
              Audit Record Payload: contract-001/{clause.id}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="font-mono text-[11px] text-[#ffc174] hover:underline flex items-center gap-1 mr-2 px-2 py-0.5 rounded bg-[#171f33] border border-[#334155]"
              type="button"
            >
              <span className="material-symbols-outlined text-[14px]">
                {copied ? 'check' : 'content_copy'}
              </span>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              className="font-mono text-[11px] text-[#7bd0ff] hover:underline flex items-center gap-1 mr-2 px-2 py-0.5 rounded bg-[#171f33] border border-[#334155]"
              type="button"
            >
              <span className="material-symbols-outlined text-[14px]">download</span> Download
            </button>
            <button
              onClick={onClose}
              className="text-[#d8c3ad] hover:text-[#dae2fd] p-1 rounded hover:bg-[#171f33]"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Modal Body: JSON Code */}
        <div className="p-4 overflow-y-auto flex-1 bg-[#060e20]">
          <pre className="font-mono text-[#dae2fd] text-[11px] leading-relaxed select-all">
            {jsonString}
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2 bg-[#2d3449] border-t border-[#334155] flex justify-between items-center text-xs text-[#d8c3ad]">
          <span className="font-mono text-[10px]">Tauri Native Local Audit Cache / StateGraph Output</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#171f33] text-[#dae2fd] font-mono text-xs rounded hover:bg-[#222a3d] border border-[#334155]"
            type="button"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
