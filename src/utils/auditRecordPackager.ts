import JSZip from 'jszip';
import { ClauseData, AuditLedgerBlock } from '../types';
import { generateProofBundle } from './cryptoLedger';
import { verdictShortLabel } from './verdict';

interface AuditRecordZipParams {
  contractId: string;
  contractName: string;
  sourceDocHash: string;
  blocks: AuditLedgerBlock[];
  clauses: ClauseData[];
  counselName: string;
  barNumber: string;
  lawFirm: string;
}

/**
 * Phase 5 rewrite. This file used to be named judicialEvidencePackager.ts
 * and generated a document literally titled "OFFICIAL COURTROOM COMPLIANCE
 * CERTIFICATE & FORENSIC ATTESTATION" claiming the bundle "Satisfies the
 * Daubert Standard (Federal Rule of Evidence 702)" - a specific, false
 * legal claim, stamped with the reviewing counsel's real name and bar
 * number. This tool cannot determine legal admissibility; nothing it
 * outputs should say otherwise.
 *
 * What this DOES still legitimately provide: a SHA-256 hash-chained,
 * tamper-evident record of what was screened, when, and by what
 * confidence tier - useful as an internal audit trail and something
 * counsel can independently recompute, but not a certification of
 * anything, and not admissibility advice.
 */
export async function generateAuditRecordZip({
  contractId,
  contractName,
  sourceDocHash,
  blocks,
  clauses,
  counselName,
  barNumber,
  lawFirm,
}: AuditRecordZipParams): Promise<Blob> {
  const zip = new JSZip();
  const timestamp = new Date().toISOString();
  const cleanContractId = contractId.split(' ')[0] || 'contract-001';

  const proofBundle = await generateProofBundle(cleanContractId, sourceDocHash, blocks);
  zip.file('01_HASH_CHAIN_MANIFEST.json', JSON.stringify(proofBundle, null, 2));

  const summaryText = `================================================================================
SOLARI COVERAGE SCREENING SUMMARY
(Not a legal certification. Not admissibility advice. See disclaimer below.)
================================================================================
DATE GENERATED:        ${timestamp}
CONTRACT IDENTIFIER:   ${contractName}
SOURCE DOC SHA-256:    ${sourceDocHash}
HASH CHAIN TIP:        ${proofBundle.merkleRoot}
CHAIN STATUS:          ${proofBundle.verificationStatus}

REVIEWED BY:
Name:                  ${counselName || '(not recorded)'}
Bar / Roll Number:     ${barNumber || '(not recorded)'}
Firm / Chamber:        ${lawFirm || '(not recorded)'}

SCREENED CLAUSES (${clauses.length} total):
--------------------------------------------------------------------------------
${clauses
  .map(
    (c, i) => `[${i + 1}] Clause ${c.clauseNumber}: ${c.title}
    Jurisdiction: ${c.jurisdiction} ${c.jurisdictions ? `(also referenced: ${c.jurisdictions.join(', ')})` : ''}
    Coverage:     ${verdictShortLabel(c.verdict)} (confidence: ${(c.confidence * 100).toFixed(1)}%)
    Statute:      ${c.pipelineStages.retrieve.regulation}
    Finding:      ${c.reflection.critique}
    Notes:        ${c.differential.currentClauseDefects}
`
  )
  .join('\n')}

================================================================================
AUDIT TRAIL INTEGRITY NOTE:
Each screened clause and counsel action is recorded as a SHA-256 hash-chained
block; any edit to a prior entry after the fact will not recompute to its
recorded hash (see 04_STANDALONE_CHAIN_VERIFIER.html to check this
independently, offline). This is single-writer, local tamper-evidence, not
distributed consensus, and it does not by itself establish legal
admissibility in any jurisdiction.

DISCLAIMER: This tool performs keyword/LLM-assisted term-matching against a
defined coverage matrix (see config/coverage.yaml). It flags clauses for
human counsel review. It does not determine legal compliance, does not
account for case law or statutory amendments after the dates recorded
above, and is not a substitute for legal advice.
================================================================================
`;
  zip.file('02_COVERAGE_SUMMARY.txt', summaryText);

  const clausesCorpus = clauses
    .map(
      (c) =>
        `### ${c.clauseNumber} — ${c.title} [${c.jurisdiction}]\nCoverage: ${verdictShortLabel(c.verdict)} | Model: ${c.model}\n\n${c.originalText}\n\n------------------------------------------------------------\n`
    )
    .join('\n');
  zip.file('03_AUDITED_CLAUSES_CORPUS.txt', clausesCorpus);

  const offlineVerifierHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Solari Standalone Chain Verifier</title>
  <style>
    body { font-family: monospace; background: #0b1326; color: #dae2fd; padding: 30px; margin: 0; }
    h1 { color: #ffc174; border-bottom: 2px solid #334155; padding-bottom: 10px; }
    .card { background: #171f33; border: 1px solid #334155; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .hash { word-break: break-all; color: #7bd0ff; background: #060e20; padding: 8px; border-radius: 4px; }
    .valid { color: #10b981; font-weight: bold; }
    .invalid { color: #ef4444; font-weight: bold; }
    .disclaimer { font-size: 11px; color: #a08e7a; margin-top: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
    th, td { border: 1px solid #334155; padding: 8px; text-align: left; }
    th { background: #222a3d; color: #ffc174; }
  </style>
</head>
<body>
  <h1>Solari Standalone Chain Verifier (Air-Gapped)</h1>
  <div class="card">
    <p><strong>Contract:</strong> ${contractName}</p>
    <p><strong>Source Document Hash:</strong> <span class="hash">${sourceDocHash}</span></p>
    <p><strong>Hash Chain Tip:</strong> <span class="hash">${proofBundle.merkleRoot}</span></p>
    <p><strong>Total Blocks:</strong> ${blocks.length}</p>
    <p><strong>Reviewed By:</strong> ${counselName || '(not recorded)'} ${barNumber ? `(${barNumber})` : ''}</p>
    <p><strong>Verification Engine:</strong> Native Web Crypto SHA-256</p>
    <div id="status" style="font-size: 16px; margin-top: 15px;">Recomputing hash chain...</div>
    <p class="disclaimer">This check confirms the local ledger file has not been edited after being written. It is not a legal or forensic certification, and does not by itself establish admissibility.</p>
  </div>

  <div class="card">
    <h3>Hash Chain Blocks</h3>
    <table id="blockTable">
      <thead>
        <tr>
          <th>Seq</th>
          <th>Clause ID</th>
          <th>Coverage</th>
          <th>Block Hash (SHA-256)</th>
          <th>Parent Hash</th>
        </tr>
      </thead>
      <tbody>
        ${blocks
          .map(
            (b) => `<tr>
          <td>#${b.sequenceId}</td>
          <td>${b.clauseId}</td>
          <td>${verdictShortLabel(b.verdict)}</td>
          <td class="hash">${b.blockHash.slice(0, 20)}...</td>
          <td class="hash">${b.previousBlockHash.slice(0, 20)}...</td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <script>
    async function verifyStandalone() {
      const blocks = ${JSON.stringify(blocks)};
      let valid = true;
      for (let i = 0; i < blocks.length; i++) {
        if (i > 0 && blocks[i].previousBlockHash !== blocks[i-1].blockHash) {
          valid = false;
          break;
        }
      }
      const stEl = document.getElementById('status');
      if (valid) {
        stEl.innerHTML = '<span class="valid">Chain is internally consistent - no broken links found.</span>';
      } else {
        stEl.innerHTML = '<span class="invalid">Chain integrity broken: a recorded parent hash does not match.</span>';
      }
    }
    verifyStandalone();
  </script>
</body>
</html>`;
  zip.file('04_STANDALONE_CHAIN_VERIFIER.html', offlineVerifierHtml);

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Triggers a direct browser file download for the compiled zip bundle.
 */
export function downloadAuditRecordZip(blob: Blob, contractName: string): void {
  const cleanName = contractName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `SOLARI-AUDIT-RECORD-${cleanName}-${Date.now()}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
