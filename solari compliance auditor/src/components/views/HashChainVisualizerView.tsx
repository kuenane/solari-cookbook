import React, { useState } from 'react';
import { AuditLedgerBlock } from '../../types';
import { verifyLedgerCryptographically } from '../../utils/cryptoLedger';
import { verdictShortLabel } from '../../utils/verdict';

interface HashChainVisualizerViewProps {
  ledgerBlocks: AuditLedgerBlock[];
  contractName: string;
  sourceDocHash: string;
  onVerifyLedger: () => void;
  isVerifying?: boolean;
}

export const HashChainVisualizerView: React.FC<HashChainVisualizerViewProps> = ({
  ledgerBlocks,
  contractName,
  sourceDocHash,
  onVerifyLedger,
  isVerifying = false,
}) => {
  const [tamperSimulatedIndex, setTamperSimulatedIndex] = useState<number | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<AuditLedgerBlock | null>(
    ledgerBlocks[ledgerBlocks.length - 1] || null
  );

  // Derive blocks with simulated tamper state if enabled
  const displayBlocks: AuditLedgerBlock[] = ledgerBlocks.map((b, idx) => {
    if (tamperSimulatedIndex !== null && idx === tamperSimulatedIndex) {
      return {
        ...b,
        calibratedScore: 0.999, // tampered value
        blockHash: 'ff00ff00ff00deadbeef1337c001d00dcafe88889999aaaabbbbccccddddeeee', // invalidated hash
      };
    }
    return b;
  });

  // Calculate live chain verification for the visualizer
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    brokenIndex?: number;
    reason?: string;
  }>({ valid: true });

  React.useEffect(() => {
    async function check() {
      if (tamperSimulatedIndex !== null) {
        setVerificationResult({
          valid: false,
          brokenIndex: tamperSimulatedIndex,
          reason: `Hash Mismatch Alert: recomputed hash does not match recorded hash at Block #${displayBlocks[tamperSimulatedIndex].sequenceId}. Parent-child linkage severed.`,
        });
      } else {
        const res = await verifyLedgerCryptographically(displayBlocks);
        setVerificationResult({
          valid: res.valid,
          reason: res.reason,
        });
      }
    }
    check();
  }, [tamperSimulatedIndex, ledgerBlocks]);

  const handleToggleTamper = () => {
    if (tamperSimulatedIndex === null) {
      // Tamper with middle block
      const target = Math.max(0, Math.floor(ledgerBlocks.length / 2));
      setTamperSimulatedIndex(target);
    } else {
      setTamperSimulatedIndex(null);
    }
  };

  return (
    <div className="flex flex-col w-full pb-8 space-y-4">
      {/* Top Banner */}
      <div className="bg-[#171f33] border border-[#334155] rounded-xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#7bd0ff]/20 text-[#7bd0ff] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">account_tree</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#dae2fd] uppercase tracking-wider font-mono">
                Hash-Chained Audit Ledger
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#222a3d] text-[#ffc174] border border-[#334155]">
                Tamper-Evident, Not Independently Certified
              </span>
            </div>
            <p className="text-xs text-[#d8c3ad] mt-0.5 font-mono">
              Linear SHA-256 hash chain: each block's hash depends on the previous one. Single-writer, tamper-evident against post-hoc edits - not distributed consensus.
            </p>
          </div>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-2">
          {/* Tamper Switch */}
          <button
            type="button"
            onClick={handleToggleTamper}
            className={`px-3 py-1.5 rounded font-mono text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 border ${
              tamperSimulatedIndex !== null
                ? 'bg-[#ef4444] text-white border-[#ef4444]'
                : 'bg-[#222a3d] hover:bg-[#334155] text-[#ffb4ab] border-[#ef4444]/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {tamperSimulatedIndex !== null ? 'link_off' : 'bug_report'}
            </span>
            <span>{tamperSimulatedIndex !== null ? 'Reset Chain (Restore Authenticity)' : 'Simulate Byte Tampering'}</span>
          </button>

          {/* Re-verify Button */}
          <button
            type="button"
            onClick={onVerifyLedger}
            disabled={isVerifying}
            className="px-3 py-1.5 rounded bg-[#10b981] hover:bg-[#059669] text-[#062c1d] font-mono text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${isVerifying ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{isVerifying ? 'Verifying...' : 'Re-verify Ledger'}</span>
          </button>
        </div>
      </div>

      {/* Verification Status Card */}
      <div
        className={`p-3.5 rounded-xl border flex items-center justify-between font-mono text-xs ${
          verificationResult.valid
            ? 'bg-[#10b981]/15 border-[#10b981]/40 text-[#10b981]'
            : 'bg-[#ef4444]/20 border-[#ef4444]/60 text-[#ffb4ab]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[22px]">
            {verificationResult.valid ? 'verified' : 'crisis_alert'}
          </span>
          <div>
            <div className="font-bold">
              {verificationResult.valid
                ? 'HASH CHAIN INTEGRITY CONFIRMED'
                : 'TAMPER DETECTED: CHAIN INTEGRITY BROKEN'}
            </div>
            <div className="text-[11px] opacity-90">
              {verificationResult.valid
                ? `All ${displayBlocks.length} blocks recompute to their recorded hash; the chain is internally consistent.`
                : verificationResult.reason}
            </div>
          </div>
        </div>
        <div className="text-right text-[11px] opacity-80 hidden sm:block">
          <div>Engine: Local SHA-256 (single-writer)</div>
          <div>Status: Tamper-Evident, Not Certified</div>
        </div>
      </div>

      {/* Interactive Visual DAG Chain */}
      <div className="bg-[#131b2e] border border-[#222a3d] rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-[#222a3d] mb-4">
          <span className="font-mono text-xs font-semibold text-[#dae2fd] uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#7bd0ff] text-[18px]">hub</span>
            Cryptographic Block Sequence Flow
          </span>
          <span className="font-mono text-[10px] text-[#94a3b8]">
            Click any block to inspect full JSON payload &amp; cryptographic signatures
          </span>
        </div>

        {/* Horizontal Visual Graph */}
        <div className="overflow-x-auto pb-4">
          <div className="flex items-center gap-3 min-w-max">
            {/* Genesis Anchor Node */}
            <div className="w-56 p-3 rounded-lg bg-[#060e20] border border-[#334155] font-mono text-xs flex flex-col justify-between shrink-0">
              <div className="flex items-center justify-between text-[10px] text-[#94a3b8] mb-1">
                <span>GENESIS ANCHOR</span>
                <span className="text-[#10b981]">BLOCK #0</span>
              </div>
              <div className="font-semibold text-[#7bd0ff] text-xs truncate" title={contractName}>
                {contractName.split(' ')[0]}
              </div>
              <div className="text-[10px] text-[#64748b] mt-1 font-mono truncate" title={sourceDocHash}>
                Doc: {sourceDocHash.slice(0, 16)}...
              </div>
              <div className="mt-2 text-[9px] text-[#10b981] bg-[#10b981]/10 px-1.5 py-0.5 rounded border border-[#10b981]/30 text-center font-bold">
                DOCUMENT ANCHOR
              </div>
            </div>

            {/* Connecting Arrow */}
            <div className="flex items-center text-[#334155]">
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </div>

            {/* Render Chain of Blocks */}
            {displayBlocks.map((block, idx) => {
              const isSelected = selectedBlock?.sequenceId === block.sequenceId;
              const isTampered = tamperSimulatedIndex === idx;

              return (
                <React.Fragment key={block.sequenceId}>
                  <div
                    onClick={() => setSelectedBlock(block)}
                    className={`w-60 p-3 rounded-lg font-mono text-xs flex flex-col justify-between shrink-0 cursor-pointer transition-all border ${
                      isTampered
                        ? 'bg-[#93000a]/40 border-[#ef4444] animate-pulse text-[#ffb4ab]'
                        : isSelected
                        ? 'bg-[#1f293d] border-[#7bd0ff] shadow-lg scale-[1.02]'
                        : 'bg-[#171f33] border-[#334155] hover:border-[#7bd0ff]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-[#ffc174] font-bold">BLOCK #{block.sequenceId}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded font-semibold ${
                          block.verdict === 'baseline_met'
                            ? 'bg-[#10b981]/20 text-[#10b981]'
                            : 'bg-[#f59e0b]/20 text-[#ffc174]'
                        }`}
                      >
                        {verdictShortLabel(block.verdict)}
                      </span>
                    </div>

                    <div className="font-semibold text-[#dae2fd] text-xs truncate">
                      {block.clauseId}
                    </div>

                    <div className="text-[10px] text-[#94a3b8] mt-1 font-mono truncate">
                      Score: {(block.calibratedScore * 100).toFixed(1)}% • {block.evaluatorModel.split(' ')[0]}
                    </div>

                    <div className="mt-2 pt-1 border-t border-[#222a3d] flex items-center justify-between text-[9px] text-[#64748b]">
                      <span className="font-mono">Hash: {block.blockHash.slice(0, 10)}...</span>
                      {block.counselSignature && (
                        <span className="text-[#ffc174] flex items-center gap-0.5" title="Signed by Counsel">
                          <span className="material-symbols-outlined text-[10px]">draw</span> Signed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Inter-block connector */}
                  {idx < displayBlocks.length - 1 && (
                    <div className="flex items-center text-[#334155]">
                      <span className="material-symbols-outlined text-[20px]">
                        {isTampered ? 'link_off' : 'arrow_forward'}
                      </span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Block Inspection Details */}
      {selectedBlock && (
        <div className="bg-[#171f33] border border-[#334155] rounded-xl p-4 shadow-sm font-mono text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#222a3d] mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ffc174] text-[18px]">data_object</span>
              <span className="font-bold text-[#dae2fd]">
                Block #{selectedBlock.sequenceId} Forensic Payload Inspector ({selectedBlock.clauseId})
              </span>
            </div>
            <span className="text-[10px] text-[#94a3b8]">Canonical Deterministic Hash Target</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div>
                <span className="text-[#94a3b8] text-[10px] uppercase block">Block SHA-256 Hash:</span>
                <div className="p-2 bg-[#060e20] rounded border border-[#334155] text-[#7bd0ff] break-all text-[11px]">
                  {selectedBlock.blockHash}
                </div>
              </div>

              <div>
                <span className="text-[#94a3b8] text-[10px] uppercase block">Parent Block Hash (Previous Hash):</span>
                <div className="p-2 bg-[#060e20] rounded border border-[#334155] text-[#d8c3ad] break-all text-[11px]">
                  {selectedBlock.previousBlockHash}
                </div>
              </div>

              <div>
                <span className="text-[#94a3b8] text-[10px] uppercase block">Source Document Hash:</span>
                <div className="p-2 bg-[#060e20] rounded border border-[#334155] text-[#d8c3ad] break-all text-[11px]">
                  {selectedBlock.sourceDocHash}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="bg-[#0b1326] p-3 rounded-lg border border-[#334155]">
                <span className="font-bold text-[#ffc174] block mb-1">Counsel Signature Stamp</span>
                {selectedBlock.counselSignature ? (
                  <div className="space-y-1 text-[11px] text-[#dae2fd]">
                    <div>Signatory: <strong>{selectedBlock.counselSignature.counsel}</strong></div>
                    <div>Roll / Bar Credential: <code className="text-[#7bd0ff]">{selectedBlock.counselSignature.barNumber}</code></div>
                    <div>Email: {selectedBlock.counselSignature.email}</div>
                    <div className="text-[10px] text-[#94a3b8] mt-1 italic">
                      Justification: "{selectedBlock.counselSignature.justification}"
                    </div>
                  </div>
                ) : (
                  <div className="text-[#94a3b8] text-[11px] italic">
                    Automated system verification block (NVIDIA NIM Nemotron-550B inference engine).
                  </div>
                )}
              </div>

              <div className="bg-[#0b1326] p-3 rounded-lg border border-[#334155] text-[11px]">
                <div className="flex justify-between py-0.5">
                  <span className="text-[#94a3b8]">Timestamp:</span>
                  <span className="text-[#dae2fd]">{selectedBlock.timestamp}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-[#94a3b8]">Evaluator Model:</span>
                  <span className="text-[#dae2fd]">{selectedBlock.evaluatorModel}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-[#94a3b8]">Calibrated Score:</span>
                  <span className="text-[#10b981] font-bold">{(selectedBlock.calibratedScore * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
