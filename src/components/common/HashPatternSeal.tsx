import React from 'react';

interface HashPatternSealProps {
  certificateRef: string;
  fingerprint: string;
  barNumber: string;
  counselName: string;
}

/**
 * Phase 5 fix: this was called JudicialQrSeal and presented itself as a
 * "Judicial Verification Seal" you could "scan to verify public ledger
 * anchor" with an unconditional "✓ Non-Repudiation Anchored" checkmark.
 * None of that was true: the pattern below is not a decodable QR code (no
 * scanner will read it), there is no public ledger to scan against (the
 * ledger is a local file), and the checkmark was shown regardless of
 * whether the chain actually verified. Relabeled as what it actually is -
 * a visual fingerprint pattern derived from the report's hash, for eyeball
 * comparison only.
 */
export const HashPatternSeal: React.FC<HashPatternSealProps> = ({
  certificateRef,
  fingerprint,
  barNumber,
}) => {
  const seed = fingerprint + certificateRef;
  const gridSize = 21;

  const getBit = (row: number, col: number) => {
    const inTopLeftFinder = row < 7 && col < 7;
    const inTopRightFinder = row < 7 && col >= gridSize - 7;
    const inBottomLeftFinder = row >= gridSize - 7 && col < 7;

    if (inTopLeftFinder) {
      if (row === 0 || row === 6 || col === 0 || col === 6) return true;
      if (row >= 2 && row <= 4 && col >= 2 && col <= 4) return true;
      return false;
    }
    if (inTopRightFinder) {
      const c = col - (gridSize - 7);
      if (row === 0 || row === 6 || c === 0 || c === 6) return true;
      if (row >= 2 && row <= 4 && c >= 2 && c <= 4) return true;
      return false;
    }
    if (inBottomLeftFinder) {
      const r = row - (gridSize - 7);
      if (r === 0 || r === 6 || col === 0 || col === 6) return true;
      if (r >= 2 && r <= 4 && col >= 2 && col <= 4) return true;
      return false;
    }

    if (row === 6 || col === 6) return (row + col) % 2 === 0;

    const charIndex = (row * gridSize + col) % seed.length;
    const charCode = seed.charCodeAt(charIndex);
    return ((charCode * (row + 3) + col * 7) % 11) > 4;
  };

  return (
    <div className="flex items-center gap-3 bg-[#0b1326] border border-[#334155] p-2.5 rounded-lg print:bg-white print:border-black print:text-black">
      <div className="shrink-0 bg-white p-1 rounded border border-gray-300">
        <svg
          viewBox={`0 0 ${gridSize} ${gridSize}`}
          className="w-16 h-16 sm:w-20 sm:h-20"
          shapeRendering="crispEdges"
        >
          {Array.from({ length: gridSize }).map((_, r) =>
            Array.from({ length: gridSize }).map((__, c) =>
              getBit(r, c) ? (
                <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#0b1326" />
              ) : null
            )
          )}
        </svg>
      </div>

      <div className="flex flex-col justify-between font-mono text-[9px] text-[#dae2fd] print:text-black leading-tight">
        <div className="flex items-center gap-1 text-[#ffc174] print:text-black font-bold uppercase tracking-wider">
          <span className="material-symbols-outlined text-[12px]">fingerprint</span>
          <span>Visual Hash Pattern</span>
        </div>
        <div className="text-[#94a3b8] print:text-gray-700 mt-0.5">
          Not a scannable QR code - for eyeball comparison only
        </div>
        <div className="font-semibold text-[#7bd0ff] print:text-black mt-1">
          {certificateRef}
        </div>
        <div className="truncate max-w-[170px] text-[#d8c3ad] print:text-gray-800">
          Roll: {barNumber.split('/')[0] || '(not recorded)'}
        </div>
        <div className="text-[8px] text-[#94a3b8] print:text-gray-700 mt-0.5">
          Derived from this report's local hash chain tip
        </div>
      </div>
    </div>
  );
};
