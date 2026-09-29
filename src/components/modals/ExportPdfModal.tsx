import React, { useEffect, useState } from 'react';
import { ClauseData } from '../../types';
import { HashPatternSeal } from '../common/HashPatternSeal';
import { verdictShortLabel, verdictColorClasses } from '../../utils/verdict';
import { sha256 } from '../../utils/cryptoLedger';

interface ExportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  clauses: ClauseData[];
  contractId: string;
  onExportProofBundle?: () => void;
  onExportEvidenceZip?: (params?: { counselName?: string; barNumber?: string; lawFirm?: string }) => void;
}

/**
 * Phase 5 rewrite. This modal used to print a document titled "OFFICIAL
 * COURTROOM COMPLIANCE CERTIFICATE & FORENSIC ATTESTATION" that claimed
 * "STATUS: COURT-ATTESTED" and "Admissible Expert Evidence Under Federal
 * Rule of Evidence 702 (Daubert)" - specific, false legal claims - and
 * pre-filled the reviewing counsel's real name with a fabricated bar
 * number. It also displayed a "cryptographic fingerprint" that was
 * actually `Math.random()` output with no relationship to the document's
 * real content.
 *
 * This version: no legal-standard claims, no prefilled real identity, and
 * the fingerprint is an actual SHA-256 hash of the report's own content.
 */
export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({
  isOpen,
  onClose,
  clauses,
  contractId,
  onExportProofBundle,
  onExportEvidenceZip,
}) => {
  const [counselName, setCounselName] = useState('');
  const [barNumber, setBarNumber] = useState('');
  const [jurisdictionAffiliation, setJurisdictionAffiliation] = useState('');
  const [lawFirm, setLawFirm] = useState('');
  const [certificateRef] = useState(`SLR-RPT-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
  const [reportFingerprint, setReportFingerprint] = useState('computing...');

  // Real fingerprint: SHA-256 of the actual reported clause data, not a
  // random string dressed up as a hash.
  useEffect(() => {
    const payload = JSON.stringify(
      clauses.map((c) => ({ id: c.id, verdict: c.verdict, confidence: c.confidence, title: c.title }))
    );
    sha256(`${contractId}:${payload}`).then((h) => setReportFingerprint(`sha256:${h}`));
  }, [clauses, contractId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportTextSummary = () => {
    const textContent = `================================================================================
SOLARI COVERAGE SCREENING REPORT
(Not a legal certification. Not admissibility advice.)
SOLARI MULTI-SURFACE AUDIT ENGINE (LANGGRAPH / NVIDIA NIM NEMOTRON 550B)
================================================================================

REPORT REFERENCE:      ${certificateRef}
AUDITED CONTRACT:      ${contractId}.pdf
DATE GENERATED:        ${new Date().toISOString()}
REPORT FINGERPRINT:    ${reportFingerprint}

REVIEWED BY (optional, self-reported, not verified by this tool):
Name:                 ${counselName || '(not recorded)'}
Bar / Roll Number:    ${barNumber || '(not recorded)'}
Admitted Bar:         ${jurisdictionAffiliation || '(not recorded)'}
Firm / Institution:   ${lawFirm || '(not recorded)'}

SCREENING RESULTS (${clauses.length} CLAUSES):
--------------------------------------------------------------------------------
${clauses
  .map(
    (c, i) =>
      `[${i + 1}] ${c.title} (${c.clauseNumber})
    Jurisdiction: ${c.jurisdiction} | Topic: ${c.topic}
    Coverage:     ${verdictShortLabel(c.verdict)} (Confidence: ${(c.confidence * 100).toFixed(1)}%)
    Statute:      ${c.pipelineStages.retrieve.regulation}
    Finding:      ${c.reflection.critique}
`
  )
  .join('\n')}
--------------------------------------------------------------------------------
DISCLAIMER:
This report reflects keyword/LLM-assisted term-matching against a defined
coverage matrix, not a legal compliance determination. It does not account
for case law or statutory amendments, and is not a substitute for legal
advice. Any name/bar number above is self-reported by the person who
generated this report and is not independently verified.
================================================================================`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coverage-screening-report-${contractId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060e20]/85 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white">
      <div className="bg-[#171f33] border border-[#334155] rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#dae2fd] print:border-none print:shadow-none print:max-h-none print:w-full print:bg-white print:text-black">
        {/* Header (Hidden on Print) */}
        <div className="px-4 py-3 bg-[#222a3d] border-b border-[#334155] flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7bd0ff] text-[20px]">description</span>
            <span className="font-mono text-xs text-[#dae2fd] font-semibold">
              Coverage Screening Report (Not a Legal Certification)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onExportEvidenceZip && (
              <button
                type="button"
                onClick={() => onExportEvidenceZip({ counselName, barNumber, lawFirm })}
                className="px-2.5 py-1 bg-[#ffc174]/20 hover:bg-[#ffc174]/30 border border-[#ffc174]/50 text-[#ffc174] font-mono text-xs font-semibold rounded flex items-center gap-1 shadow-sm transition-colors"
                title="Download offline audit record ZIP (hash-chain manifest, summary, clause corpus & standalone verifier)"
              >
                <span className="material-symbols-outlined text-[15px]">folder_zip</span>
                Audit Record (.zip)
              </button>
            )}
            {onExportProofBundle && (
              <button
                type="button"
                onClick={onExportProofBundle}
                className="px-2.5 py-1 bg-[#10b981]/20 hover:bg-[#10b981]/30 border border-[#10b981]/40 text-[#10b981] font-mono text-xs font-semibold rounded flex items-center gap-1 shadow-sm transition-colors"
                title="Download JSON hash-chain proof bundle"
              >
                <span className="material-symbols-outlined text-[15px]">verified_user</span>
                Proof Bundle (.json)
              </button>
            )}
            <button
              type="button"
              onClick={handleExportTextSummary}
              className="px-2.5 py-1 bg-[#222a3d] hover:bg-[#334155] border border-[#334155] text-[#dae2fd] font-mono text-xs font-semibold rounded flex items-center gap-1 shadow-sm transition-colors"
              title="Download plain-text summary"
            >
              <span className="material-symbols-outlined text-[15px]">description</span>
              Summary (.txt)
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1 bg-[#f59e0b] hover:bg-[#ffc174] text-[#472a00] font-mono text-xs font-semibold rounded flex items-center gap-1 shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">print</span>
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-[#d8c3ad] hover:text-[#dae2fd] p-1 rounded"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Optional Reviewer Info Editor Ribbon (Hidden on Print) */}
        <div className="px-6 py-2.5 bg-[#121929] border-b border-[#222a3d] text-xs font-mono grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 print:hidden">
          <div>
            <label className="text-[10px] text-[#94a3b8] uppercase tracking-wider block mb-0.5">
              Reviewed By (optional)
            </label>
            <input
              type="text"
              value={counselName}
              onChange={(e) => setCounselName(e.target.value)}
              placeholder="Not recorded"
              className="w-full bg-[#1b243b] border border-[#334155] rounded px-2 py-1 text-[#dae2fd] focus:outline-none focus:border-[#7bd0ff]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#94a3b8] uppercase tracking-wider block mb-0.5">
              Bar / Roll ID (optional, self-reported)
            </label>
            <input
              type="text"
              value={barNumber}
              onChange={(e) => setBarNumber(e.target.value)}
              placeholder="Not recorded"
              className="w-full bg-[#1b243b] border border-[#334155] rounded px-2 py-1 text-[#dae2fd] focus:outline-none focus:border-[#7bd0ff]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#94a3b8] uppercase tracking-wider block mb-0.5">
              Firm / Organization (optional)
            </label>
            <input
              type="text"
              value={lawFirm}
              onChange={(e) => setLawFirm(e.target.value)}
              placeholder="Not recorded"
              className="w-full bg-[#1b243b] border border-[#334155] rounded px-2 py-1 text-[#dae2fd] focus:outline-none focus:border-[#7bd0ff]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#94a3b8] uppercase tracking-wider block mb-0.5">
              Jurisdiction (optional)
            </label>
            <input
              type="text"
              value={jurisdictionAffiliation}
              onChange={(e) => setJurisdictionAffiliation(e.target.value)}
              placeholder="Not recorded"
              className="w-full bg-[#1b243b] border border-[#334155] rounded px-2 py-1 text-[#dae2fd] focus:outline-none focus:border-[#7bd0ff]"
            />
          </div>
        </div>

        {/* Printable Report Canvas */}
        <div className="p-8 overflow-y-auto flex-1 bg-[#0b1326] space-y-5 font-sans text-xs print:bg-white print:text-black print:p-0">
          {/* Report Header Banner */}
          <div className="border-b-2 border-[#334155] pb-4 flex justify-between items-start print:border-black">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="material-symbols-outlined text-[#ffc174] text-[26px] print:text-black">
                  description
                </span>
                <span className="font-bold text-sm tracking-wider text-[#ffc174] print:text-black">
                  SOLARI COVERAGE SCREENING REPORT
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#dae2fd] print:text-black uppercase tracking-tight">
                First-Pass Compliance Screening Summary
              </h2>
              <p className="text-[#d8c3ad] font-mono text-[11px] mt-0.5 print:text-gray-700">
                Term-matching against a defined coverage matrix. Not a legal certification or admissibility determination.
              </p>
            </div>
            <div className="text-right font-mono text-[10px] text-[#d8c3ad] print:text-black space-y-0.5">
              <div className="font-bold text-[#ffc174] print:text-black">{certificateRef}</div>
              <div>GENERATED: {new Date().toLocaleDateString()}</div>
              <div>TIME: {new Date().toLocaleTimeString()}</div>
              <div className="text-[#94a3b8] print:text-gray-700 font-semibold">STATUS: SCREENING REPORT (UNCERTIFIED)</div>
            </div>
          </div>

          {/* Reviewer & Method Declaration Box */}
          <div className="bg-[#171f33] p-4 rounded-lg border border-[#334155] print:bg-gray-50 print:border-gray-300">
            <h3 className="font-mono text-xs font-semibold text-[#ffc174] mb-2 uppercase tracking-wide print:text-black flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">info</span>
              1. Method &amp; Reviewer (self-reported)
            </h3>
            <p className="text-[#dae2fd] leading-relaxed print:text-black mb-3 text-[11px]">
              This screening of <code className="text-[#7bd0ff] print:text-black">{contractId}.pdf</code> was
              produced by keyword-gated, LLM-assisted term-matching (temperature=0.1) against the coverage
              matrix in <code className="text-[#ffc174] print:text-black">config/coverage.yaml</code>, using the
              Solari pipeline with an NVIDIA NIM model for ambiguous matches.
              {counselName && (
                <>
                  {' '}Reviewed by <strong className="text-[#7bd0ff] print:text-black">{counselName}</strong>
                  {barNumber && <> (Bar/Roll ID <code className="bg-[#0b1326] px-1.5 py-0.5 rounded text-[#ffc174] print:bg-transparent print:text-black font-mono">{barNumber}</code>)</>}
                  {jurisdictionAffiliation && <>, {jurisdictionAffiliation}</>}. This field is self-reported and not verified by this tool.
                </>
              )}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-[#222a3d] print:border-gray-200 font-mono text-[10px]">
              <div>
                <span className="text-[#94a3b8] block">ORGANIZATION:</span>
                <span className="text-[#dae2fd] print:text-black font-medium">{lawFirm || 'Not recorded'}</span>
              </div>
              <div>
                <span className="text-[#94a3b8] block">CERTIFICATION STATUS:</span>
                <span className="text-[#94a3b8] print:text-black font-medium">Not certified - screening only</span>
              </div>
              <div>
                <span className="text-[#94a3b8] block">SOURCE MATRIX:</span>
                <span className="text-[#7bd0ff] print:text-black font-medium">config/coverage.yaml</span>
              </div>
              <div>
                <span className="text-[#94a3b8] block">PII HANDLING:</span>
                <span className="text-[#10b981] print:text-black font-medium">Client-side pattern redaction</span>
              </div>
            </div>
          </div>

          {/* Evaluated Clauses Findings Table */}
          <div>
            <h3 className="font-mono text-xs font-semibold text-[#ffc174] mb-2 uppercase tracking-wide print:text-black flex items-center justify-between">
              <span>2. Clause Coverage Table ({clauses.length} Clauses)</span>
              <span className="text-[10px] text-[#94a3b8] normal-case">Screened against configured statutory sources</span>
            </h3>
            <div className="border border-[#334155] rounded-lg overflow-hidden print:border-gray-300">
              <table className="w-full text-left font-mono text-[11px] print:text-[10px]">
                <thead className="bg-[#1f293d] text-[#d8c3ad] border-b border-[#334155] print:bg-gray-100 print:text-black">
                  <tr>
                    <th className="p-2 w-32">Section</th>
                    <th className="p-2">Statutory Benchmark</th>
                    <th className="p-2 w-20">Jurisdiction</th>
                    <th className="p-2 w-24">Confidence</th>
                    <th className="p-2 w-28">Coverage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222a3d] print:divide-gray-200">
                  {clauses.map((c) => (
                    <tr key={c.id} className="hover:bg-[#171f33] print:hover:bg-white">
                      <td className="p-2 font-semibold text-[#dae2fd] print:text-black">
                        <div>{c.title}</div>
                        <div className="text-[9px] text-[#94a3b8]">{c.lines}</div>
                      </td>
                      <td className="p-2 text-[#d8c3ad] print:text-black">
                        <div className="font-semibold text-[#7bd0ff] print:text-black">{c.pipelineStages.retrieve.regulation}</div>
                        <p className="text-[10px] text-[#94a3b8] print:text-gray-600 line-clamp-2 mt-0.5">
                          {c.reflection.critique}
                        </p>
                      </td>
                      <td className="p-2">
                        <span className="px-1.5 py-0.5 rounded bg-[#222a3d] text-[#dae2fd] print:bg-transparent print:text-black border border-[#334155] print:border-none text-[10px]">
                          {c.jurisdiction === 'ZA' ? '🇿🇦 RSA' : c.jurisdiction === 'LS' ? '🇱🇸 Lesotho' : c.jurisdiction === 'EU' ? '🇪🇺 EU' : '🇺🇸 US'}
                        </span>
                      </td>
                      <td className="p-2 text-[#ffc174] print:text-black">
                        {(c.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="p-2 font-semibold">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] border ${verdictColorClasses(c.verdict)} print:border-none print:bg-transparent`}>
                          {verdictShortLabel(c.verdict)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fingerprint & Reviewer Sign-off Block */}
          <div className="pt-4 border-t-2 border-[#334155] print:border-black grid grid-cols-1 md:grid-cols-2 gap-6 text-[10px] font-mono text-[#d8c3ad] print:text-black">
            <div className="space-y-3">
              <HashPatternSeal
                certificateRef={certificateRef}
                fingerprint={reportFingerprint}
                barNumber={barNumber}
                counselName={counselName}
              />

              <div className="border border-[#222a3d] p-2.5 rounded-lg print:border-gray-300">
                <span className="font-bold text-[#ffc174] print:text-black uppercase block tracking-wider mb-1">
                  Report Fingerprint (SHA-256 of report contents)
                </span>
                <div className="break-all font-mono text-[8px] text-[#7bd0ff] print:text-black bg-[#0b1326] p-1.5 rounded print:bg-gray-50 border border-[#334155] print:border-gray-200">
                  {reportFingerprint}
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between border border-[#222a3d] p-3 rounded-lg print:border-gray-300">
              <div>
                <span className="font-bold text-[#dae2fd] print:text-black uppercase block tracking-wider mb-1">
                  Reviewer Sign-off (optional)
                </span>
                <div className="h-12 border-b border-dashed border-[#64748b] flex items-end pb-1 font-serif italic text-base text-[#7bd0ff] print:text-black">
                  {counselName || '\u00A0'}
                </div>
              </div>
              <div className="flex justify-between items-center text-[9px] text-[#94a3b8] print:text-gray-600 mt-2">
                <span>SELF-REPORTED, NOT VERIFIED BY THIS TOOL</span>
                <span>SCREENING REPORT ONLY</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
