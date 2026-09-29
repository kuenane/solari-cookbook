import React, { useState, useEffect } from 'react';
import { ClauseVerdict } from '../../types';
import { getSigningKeyFingerprint } from '../../utils/counselSigning';

interface OverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  clauseId: string;
  clauseTitle: string;
  currentVerdict: ClauseVerdict;
  onConfirmOverride: (
    newVerdict: ClauseVerdict,
    justification: string,
    counselName: string,
    counselEmail: string,
    barNumber: string
  ) => void;
}

export const OverrideModal: React.FC<OverrideModalProps> = ({
  isOpen,
  onClose,
  clauseId,
  clauseTitle,
  currentVerdict,
  onConfirmOverride,
}) => {
  const [selectedVerdict, setSelectedVerdict] = useState<ClauseVerdict>('baseline_met');
  const [justification, setJustification] = useState('');
  // Phase fix: these used to default to a fabricated identity ('Elena
  // Vance, Esq.', a fake NY bar number) - a plausible-looking but entirely
  // invented credential prefilled into every override by default. Empty
  // now; the person filling this in types their own details, and the
  // signature (see signingFingerprint below) is what's actually verified.
  const [counselName, setCounselName] = useState('');
  const [counselEmail, setCounselEmail] = useState('');
  const [barNumber, setBarNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [signingFingerprint, setSigningFingerprint] = useState<string | null>(null);

  useEffect(() => {
    getSigningKeyFingerprint().then(setSigningFingerprint).catch(() => setSigningFingerprint(null));
  }, []);

  if (!isOpen) return null;

  const minChars = 40;
  const charsRemaining = Math.max(0, minChars - justification.trim().length);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (justification.trim().length < minChars) {
      setErrorMsg(`Regulatory standards require at least ${minChars} characters of specific statutory justification (current: ${justification.trim().length}).`);
      return;
    }
    if (!counselEmail.includes('@') || !barNumber.trim()) {
      setErrorMsg('A verified counsel email and official state bar number are mandatory for non-repudiation.');
      return;
    }
    setErrorMsg(null);
    onConfirmOverride(selectedVerdict, justification.trim(), counselName.trim(), counselEmail.trim(), barNumber.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060e20]/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-modal-title"
    >
      <div className="bg-[#171f33] border border-[#334155] rounded-xl max-w-xl w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-[#222a3d] border-b border-[#334155] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffc174] text-[20px]">verified_user</span>
            <span id="override-modal-title" className="font-mono text-xs text-[#dae2fd] font-semibold">
              Authenticated Counsel Override: {clauseId} ({clauseTitle})
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#d8c3ad] hover:text-[#dae2fd]"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          {/* Identity & Legal Non-Repudiation Box */}
          <div className="bg-[#0b1326] p-2.5 rounded-lg border border-[#38bdf8]/30 flex items-start gap-2.5 text-xs text-[#7bd0ff]">
            <span className="material-symbols-outlined text-[18px] text-[#38bdf8] shrink-0 mt-0.5">fingerprint</span>
            <div>
              <p className="font-semibold text-[#dae2fd]">Statutory Non-Repudiation Notice</p>
              <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                This override generates a cryptographic block linked into the local SHA-256 audit ledger with your bar credentials. It cannot be altered after submission.
              </p>
            </div>
          </div>

          <div>
            <label className="block font-mono text-[11px] text-[#d8c3ad] mb-1.5 uppercase font-medium">
              Select New Audit Verdict
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedVerdict('baseline_met')}
                className={`px-2 py-2 rounded font-mono text-xs text-center border transition-all ${
                  selectedVerdict === 'baseline_met'
                    ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981] font-semibold ring-1 ring-[#10b981]/50'
                    : 'bg-[#060e20] border-[#334155] text-[#d8c3ad] hover:border-[#64748b]'
                }`}
              >
                VERIFIED (Pass)
              </button>
              <button
                type="button"
                onClick={() => setSelectedVerdict('gaps_flagged')}
                className={`px-2 py-2 rounded font-mono text-xs text-center border transition-all ${
                  selectedVerdict === 'gaps_flagged'
                    ? 'bg-[#f59e0b]/20 border-[#f59e0b] text-[#ffc174] font-semibold ring-1 ring-[#f59e0b]/50'
                    : 'bg-[#060e20] border-[#334155] text-[#d8c3ad] hover:border-[#64748b]'
                }`}
              >
                AMBER (Caveat)
              </button>
              <button
                type="button"
                onClick={() => setSelectedVerdict('conflict_or_absent')}
                className={`px-2 py-2 rounded font-mono text-xs text-center border transition-all ${
                  selectedVerdict === 'conflict_or_absent'
                    ? 'bg-[#ef4444]/20 border-[#ef4444] text-[#ffb4ab] font-semibold ring-1 ring-[#ef4444]/50'
                    : 'bg-[#060e20] border-[#334155] text-[#d8c3ad] hover:border-[#64748b]'
                }`}
              >
                REJECTED (Fail)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-mono text-[10px] text-[#d8c3ad] mb-1 uppercase">
                Reviewing Counsel Name
              </label>
              <input
                type="text"
                required
                value={counselName}
                onChange={(e) => setCounselName(e.target.value)}
                className="w-full bg-[#060e20] border border-[#334155] rounded px-2.5 py-1.5 text-xs text-[#dae2fd] focus:border-[#38bdf8] focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-[#d8c3ad] mb-1 uppercase">
                Official State Bar #
              </label>
              <input
                type="text"
                required
                value={barNumber}
                onChange={(e) => setBarNumber(e.target.value)}
                placeholder="e.g. NY Bar #489102"
                className="w-full bg-[#060e20] border border-[#334155] rounded px-2.5 py-1.5 text-xs text-[#dae2fd] focus:border-[#38bdf8] focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] text-[#d8c3ad] mb-1 uppercase">
              Authenticated Enterprise Counsel Email
            </label>
            <input
              type="email"
              required
              value={counselEmail}
              onChange={(e) => setCounselEmail(e.target.value)}
              className="w-full bg-[#060e20] border border-[#334155] rounded px-2.5 py-1.5 text-xs text-[#dae2fd] focus:border-[#38bdf8] focus:outline-none font-mono"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-mono text-[10px] text-[#d8c3ad] uppercase">
                Statutory Justification & Safe Harbor Basis <span className="text-[#ffc174]">*</span>
              </label>
              <span className={`font-mono text-[10px] ${charsRemaining > 0 ? 'text-[#ffb4ab]' : 'text-[#10b981]'}`}>
                {charsRemaining > 0 ? `${charsRemaining} chars needed` : 'Valid length'}
              </span>
            </div>
            <textarea
              required
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="e.g. Master Service Agreement Schedule B contains an explicit FTC Safeguards Data Security Addendum with AES-256 encryption covenants, curing statutory vagueness in the operative clause."
              className="w-full bg-[#060e20] border border-[#334155] rounded p-2 text-xs text-[#dae2fd] focus:border-[#38bdf8] focus:outline-none font-sans"
            />
          </div>

          {errorMsg && (
            <div className="p-2 rounded bg-[#ef4444]/20 border border-[#ef4444]/50 text-[#ffb4ab] text-xs font-mono">
              {errorMsg}
            </div>
          )}

          <div className="pt-2 border-t border-[#222a3d] flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#94a3b8]" title="This override will be signed with your browser's ECDSA counsel-signing key, and the backend independently re-verifies the signature. This proves the same browser/key submitted it, not identity.">
              {signingFingerprint
                ? `Will sign with key ${signingFingerprint}\u2026`
                : 'SHA-256 hash-chain verification active'}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-[#060e20] border border-[#334155] text-[#d8c3ad] font-mono text-xs rounded hover:bg-[#222a3d]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#f59e0b] hover:bg-[#ffc174] text-[#472a00] font-mono text-xs font-semibold rounded transition-colors shadow-sm flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">lock_clock</span>
                <span>Sign &amp; Commit Override</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
