import React, { useState } from 'react';
import { ClauseData } from '../../types';

interface RedlineEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  clause: ClauseData;
  onApplyRedline: (clauseId: string, revisedText: string, reason: string) => void;
}

export type NegotiationPosture = 'customer_strict' | 'market_compromise' | 'vendor_favorable';

export const RedlineEditorModal: React.FC<RedlineEditorModalProps> = ({
  isOpen,
  onClose,
  clause,
  onApplyRedline,
}) => {
  const [posture, setPosture] = useState<NegotiationPosture>('market_compromise');
  const [editedText, setEditedText] = useState(clause.originalText);
  const [justification, setJustification] = useState(
    clause.dualSovereignAudit
      ? 'Incorporated reciprocal SADC bilateral safeguards pursuant to POPIA § 72 and Lesotho DPA § 24.'
      : 'Resolved statutory ambiguity and established mandatory breach notification window.'
  );

  if (!isOpen) return null;

  // Posture-specific statutory covenant generators
  const getCovenantForPosture = (targetPosture: NegotiationPosture) => {
    const isSADC = clause.jurisdictions?.includes('LS') || clause.jurisdiction === 'LS';
    const isZA = clause.jurisdiction === 'ZA';

    if (targetPosture === 'customer_strict') {
      if (isSADC) {
        return `Customer authorizes strict transborder data transmission from the Kingdom of Lesotho to designated cloud hosting facilities in the Republic of South Africa solely under the explicit condition that Service Provider warrants absolute compliance with Lesotho DPA 2012 § 24 and POPIA Act 4 of 2013. Service Provider shall notify Customer within twenty-four (24) hours of any security compromise or unauthorized access, with uncapped indemnity for regulatory penalties imposed by the Lesotho Communications Authority (LCA) or the South African Information Regulator.`;
      }
      if (isZA) {
        return `Service Provider warrants unconditional compliance as an Operator under South African POPIA Act 4 of 2013, processing personal information solely on documented written instructions of Customer. Service Provider covenants to implement AES-256 encryption at rest and in transit, notify Customer within twenty-four (24) hours of any suspected compromise under Section 22, and provide full audit rights upon five (5) days notice without liability limitations.`;
      }
      return `Service Provider covenants to implement and maintain administrative, technical, and physical safeguards consistent with 16 CFR § 314.4 and ISO 27001. All customer confidential data must be encrypted using AES-256 at rest and TLS 1.3 in transit. In the event of a security compromise, Service Provider shall notify Customer within twenty-four (24) hours and provide uncapped remediation indemnification.`;
    }

    if (targetPosture === 'vendor_favorable') {
      if (isSADC) {
        return `Customer consents to the cross-border transmission of operational telemetry and data packets outside the borders of the Kingdom of Lesotho to regional data centers in Johannesburg. Service Provider shall take commercially reasonable steps consistent with industry standards in Southern Africa. Any liability arising from regulatory enforcement shall be subject to the standard mutual liability cap set forth in Section 3.1 of this Agreement.`;
      }
      if (isZA) {
        return `Service Provider shall process personal information as an Operator under POPIA Act 4 of 2013 using reasonable commercial efforts to maintain technical security. Service Provider shall notify Customer of verified data breaches without undue delay, and any claim shall be governed by the standard aggregate fee limitation.`;
      }
      return `Service Provider agrees to maintain reasonable commercial safeguards to protect confidential information. Notice of security compromises shall be provided within five (5) business days of forensic confirmation, with liability strictly subject to the twelve-month fee cap.`;
    }

    // Default: 'market_compromise' (Standard Safe Harbor)
    if (isSADC) {
      return `Customer authorizes the cross-border transfer of communications and telemetry data from the Kingdom of Lesotho to designated cloud facilities in the Republic of South Africa, on the condition that Service Provider maintains adequate technical safeguards complying with Section 24 of the Lesotho Data Protection Act 2012 (Act No. 5 of 2012) and Section 19 of POPIA 2013. Service Provider covenants to notify Customer and provide a detailed forensic incident report within forty-eight (48) hours of any security compromise, preserving data subject rights under prevailing SADC Model Laws.`;
    }
    if (isZA) {
      return `Service Provider shall act as an Operator under the South African Protection of Personal Information Act (POPIA Act 4 of 2013), processing personal information solely on documented written instructions of Customer as Responsible Party. Service Provider shall establish and maintain appropriate, reasonable technical and organizational security measures pursuant to POPIA Section 19 and provide immediate notification of security compromises under Section 22.`;
    }
    return `Service Provider covenants to implement and maintain administrative, technical, and physical safeguards consistent with 16 CFR § 314.4. All customer confidential data must be encrypted using AES-256 at rest and TLS 1.3 in transit. In the event of a security breach, Service Provider shall notify Customer within seventy-two (72) hours.`;
  };

  const handlePostureChange = (newPosture: NegotiationPosture) => {
    setPosture(newPosture);
    setEditedText(getCovenantForPosture(newPosture));
    if (newPosture === 'customer_strict') {
      setJustification('Applied Customer-Protective Maximum Statutory Covenant (24h breach notice, strict adequacy warranties).');
    } else if (newPosture === 'vendor_favorable') {
      setJustification('Applied Vendor-Favorable Commercial Compromise (reasonable efforts, standard liability alignment).');
    } else {
      setJustification('Applied SADC Market Standard Safe Harbor Covenant (POPIA § 72 & Lesotho DPA § 24 balanced).');
    }
  };

  const predictedConfidence =
    posture === 'customer_strict' ? 0.98 : posture === 'market_compromise' ? 0.95 : 0.82;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApplyRedline(clause.id, editedText, justification);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060e20]/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#171f33] border border-[#334155] rounded-xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#dae2fd]">
        {/* Header */}
        <div className="px-4 py-3 bg-[#222a3d] border-b border-[#334155] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffc174] text-[20px]">draw</span>
            <span className="font-mono text-xs text-[#dae2fd] font-semibold">
              Live Interactive Redline Editor — {clause.clauseNumber} ({clause.title})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#d8c3ad] hover:text-[#dae2fd] p-1 rounded"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 font-mono text-xs">
          {/* Autonomous Negotiation Posture Selector */}
          <div className="bg-[#0b1326] border border-[#334155] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#ffc174] font-semibold flex items-center gap-1.5 text-xs">
                <span className="material-symbols-outlined text-[16px]">tune</span>
                Negotiation Posture &amp; Statutory Risk Calibration
              </span>
              <span className="text-[10px] text-[#94a3b8]">AI Draft Synthesizer</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Option 1: Customer Strict */}
              <button
                type="button"
                onClick={() => handlePostureChange('customer_strict')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  posture === 'customer_strict'
                    ? 'bg-[#10b981]/20 border-[#10b981] text-[#dae2fd]'
                    : 'bg-[#131b2e] border-[#334155] text-[#94a3b8] hover:border-[#10b981]/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-[#10b981]">Customer Strict</span>
                  <span className="text-[10px] font-mono text-[#10b981]">98% Confidence</span>
                </div>
                <p className="text-[10px] leading-tight text-[#94a3b8]">
                  24h breach notice, zero liability cap carveouts, maximum statutory indemnity.
                </p>
              </button>

              {/* Option 2: Market Compromise */}
              <button
                type="button"
                onClick={() => handlePostureChange('market_compromise')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  posture === 'market_compromise'
                    ? 'bg-[#7bd0ff]/20 border-[#7bd0ff] text-[#dae2fd]'
                    : 'bg-[#131b2e] border-[#334155] text-[#94a3b8] hover:border-[#7bd0ff]/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-[#7bd0ff]">Market Standard</span>
                  <span className="text-[10px] font-mono text-[#7bd0ff]">95% Confidence</span>
                </div>
                <p className="text-[10px] leading-tight text-[#94a3b8]">
                  48-72h notice, SADC bilateral safe harbor terms, reciprocal safeguards.
                </p>
              </button>

              {/* Option 3: Vendor Favorable */}
              <button
                type="button"
                onClick={() => handlePostureChange('vendor_favorable')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  posture === 'vendor_favorable'
                    ? 'bg-[#f59e0b]/20 border-[#f59e0b] text-[#dae2fd]'
                    : 'bg-[#131b2e] border-[#334155] text-[#94a3b8] hover:border-[#f59e0b]/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-[#ffc174]">Vendor Favorable</span>
                  <span className="text-[10px] font-mono text-[#ffc174]">82% Confidence</span>
                </div>
                <p className="text-[10px] leading-tight text-[#94a3b8]">
                  Commercial reasonable efforts, standard notice, capped liability.
                </p>
              </button>
            </div>
          </div>

          {/* Original vs Redline Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Original Defective Text */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-[#ffb4ab] uppercase tracking-wider font-semibold">
                Original Text (Flagged Defects)
              </span>
              <div className="p-3 bg-[#060e20] border border-[#ef4444]/30 rounded-lg text-[#d8c3ad] text-[11px] leading-relaxed h-44 overflow-y-auto">
                {clause.originalText}
              </div>
            </div>

            {/* Editable Redline Text */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#10b981] uppercase tracking-wider font-semibold">
                  Proposed Redline (Live Text)
                </span>
                <span className="text-[10px] text-[#7bd0ff] font-mono">
                  Predicted Score: {(predictedConfidence * 100).toFixed(0)}%
                </span>
              </div>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                rows={7}
                className="w-full p-3 bg-[#0b1326] border border-[#10b981]/50 rounded-lg text-[#dae2fd] text-[11px] leading-relaxed focus:outline-none focus:border-[#7bd0ff] resize-none h-44"
                placeholder="Enter revised statutory text..."
              />
            </div>
          </div>

          {/* Legal Justification */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[#94a3b8] uppercase tracking-wider font-semibold">
              Counsel Justification (Committed to Hash-Chained Audit Trail)
            </label>
            <input
              type="text"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="w-full bg-[#0b1326] border border-[#334155] rounded px-3 py-2 text-[#dae2fd] text-xs focus:outline-none focus:border-[#7bd0ff]"
              required
            />
          </div>

          {/* Expected Outcome Pill */}
          <div className="p-2.5 rounded bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#10b981] text-[18px]">verified</span>
              <span className="text-[#10b981] text-[11px]">
                Upon commitment, confidence will recalculate to <strong>{(predictedConfidence * 100).toFixed(0)}% (VERIFIED)</strong> and anchor a new block to the immutable ledger.
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222a3d]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-[#222a3d] hover:bg-[#334155] text-[#d8c3ad] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-[#10b981] hover:bg-[#059669] text-[#062c1d] font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>Commit Redline to Ledger</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
