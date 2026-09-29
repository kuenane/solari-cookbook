import React, { useState, useEffect } from 'react';

interface ReRunAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (newConfidence: number) => void;
  clauseId: string;
}

export const ReRunAuditModal: React.FC<ReRunAuditModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  clauseId,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [temperature, setTemperature] = useState<number>(0.1);
  const [useExpandedContext, setUseExpandedContext] = useState<boolean>(true);
  const [isDone, setIsDone] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setIsDone(false);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= 4) {
          clearInterval(interval);
          setIsDone(true);
          return 4;
        }
        return prev + 1;
      });
    }, 650);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const steps = [
    { label: '01. RETRIEVE', detail: 'BrowserSurface scraping live regulation URL from FTC Privacy & Security...' },
    { label: '02. MATCH', detail: `NVIDIA NIM executing nvidia/nemotron-3-ultra-550b-a55b with Temp=${temperature}...` },
    { label: '03. REFLECT', detail: 'NVIDIA NIM critique verifying statutory soundness and penalty drift...' },
    { label: '04. SCORE', detail: 'Assigning red/amber/green verdict and logging to DesktopSurface...' },
  ];

  const handleFinish = () => {
    const updatedConfidence = useExpandedContext ? 0.84 : 0.72;
    onComplete(updatedConfidence);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060e20]/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#171f33] border border-[#334155] rounded-xl max-w-lg w-full p-4 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#222a3d]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffc174] text-[20px] animate-spin">
              refresh
            </span>
            <span className="font-mono text-xs text-[#dae2fd] font-semibold">
              Re-executing Deterministic Audit: {clauseId}
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

        {/* Configuration Options */}
        <div className="bg-[#060e20] p-3 rounded-lg border border-[#222a3d] space-y-2 font-mono text-xs">
          <div className="flex justify-between items-center">
            <span className="text-[#d8c3ad]">Sampling Temperature:</span>
            <div className="flex items-center gap-2">
              {[0.1, 0.2, 0.35].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTemperature(t)}
                  className={`px-2 py-0.5 rounded text-[11px] ${
                    temperature === t
                      ? 'bg-[#f59e0b] text-[#472a00] font-semibold'
                      : 'bg-[#171f33] text-[#d8c3ad]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#d8c3ad]">Expand Surrounding AST Context:</span>
            <input
              type="checkbox"
              checked={useExpandedContext}
              onChange={(e) => setUseExpandedContext(e.target.checked)}
              className="accent-[#f59e0b]"
            />
          </div>
        </div>

        {/* Execution Steps */}
        <div className="space-y-2">
          {steps.map((s, idx) => {
            const isCompleted = currentStep > idx;
            const isCurrent = currentStep === idx;

            return (
              <div
                key={idx}
                className={`p-2 rounded border transition-all ${
                  isCurrent
                    ? 'bg-[#222a3d] border-[#f59e0b] text-[#ffc174]'
                    : isCompleted
                    ? 'bg-[#060e20] border-[#10b981]/40 text-[#10b981]'
                    : 'bg-[#060e20] border-[#222a3d] text-[#a08e7a]'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-semibold">{s.label}</span>
                  {isCompleted && (
                    <span className="text-[11px] text-[#10b981] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">check</span> Done
                    </span>
                  )}
                  {isCurrent && (
                    <span className="text-[11px] text-[#ffc174] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] animate-spin">sync</span> In Progress
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-sans mt-0.5 opacity-90">{s.detail}</p>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2 border-t border-[#222a3d]">
          {isDone ? (
            <button
              type="button"
              onClick={handleFinish}
              className="px-4 py-1.5 bg-[#10b981] hover:bg-[#059669] text-[#064e3b] font-mono text-xs font-semibold rounded shadow transition-all"
            >
              Apply New Audit Results ({useExpandedContext ? 'Confidence 0.84' : 'Confidence 0.72'})
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="px-3 py-1 bg-[#171f33] text-[#d8c3ad] font-mono text-xs rounded opacity-60"
            >
              Simulating Pipeline...
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
