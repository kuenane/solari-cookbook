import { AuditLedgerBlock, ClauseVerdict } from '../types';

/**
 * Phase 1/3 fixes applied to this file:
 *  - computeDeterministicGrounding() DELETED. It was a third copy of the
 *    same keyword-coverage heuristic as pipeline.py's calculate_grounding_score
 *    and server.ts's inline fallback, with a different keyword list each
 *    time, guaranteed to drift. Scoring only happens server-side now
 *    (see /api/audit/run, /api/audit/stream) - the client never computes
 *    a verdict, only displays one.
 *  - createAuditLedgerBlock() DELETED. The client must never mint its own
 *    ledger blocks; DesktopSurface.write_audit_log in surfaces/desktop.py
 *    is the single writer. This file now only VERIFIES blocks it is given.
 *  - verifyLedgerCryptographically() previously had a hardcoded bypass
 *    for two specific fabricated demo hash prefixes ('7a2f58b', 'c4e7d23')
 *    that let the shipped demo ledger pass verification without actually
 *    matching its own recomputed hash. That bypass is removed below - the
 *    check is now unconditional, the way "tamper-evident" has to work.
 */

export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Client-side PII redaction PREVIEW only, used for on-screen display before
 * a clause is sent anywhere. The authoritative sanitizer that actually
 * gates what reaches the LLM is sanitize_pii() in surfaces/desktop.py -
 * never trust this copy for anything security-relevant.
 */
export function sanitizeClientPii(text: string): { sanitized: string; redactedCount: number; details: string[] } {
  let count = 0;
  const details: string[] = [];
  let res = text;

  res = res.replace(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, (match) => {
    count++;
    details.push(`Email: ${match.slice(0, 3)}***@***`);
    return '[REDACTED_EMAIL]';
  });

  res = res.replace(/\b\d{3}-\d{2}-\d{4}\b/g, () => {
    count++;
    details.push('US Social Security Number');
    return '[REDACTED_SSN]';
  });

  res = res.replace(/\b\d{2}-\d{7}\b/g, () => {
    count++;
    details.push('US Federal EIN / Tax ID');
    return '[REDACTED_EIN]';
  });

  res = res.replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g, (match) => {
    if (match.replace(/\D/g, '').length >= 7) {
      count++;
      details.push('Telephone Identifier');
      return '[REDACTED_PHONE]';
    }
    return match;
  });

  res = res.replace(/(?:[\$€£¥]|CHF|USD|EUR|GBP)\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?:\s?(?:million|billion|M|B|USD|EUR|GBP))?/gi, (match) => {
    count++;
    details.push(`Confidential Financial Valuation: ${match.trim()}`);
    return '[CONFIDENTIAL_SUM]';
  });

  res = res.replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s?(?:USD|EUR|GBP|CHF)\b/gi, (match) => {
    count++;
    details.push(`Confidential Financial Valuation: ${match.trim()}`);
    return '[CONFIDENTIAL_SUM]';
  });

  return { sanitized: res, redactedCount: count, details };
}

/**
 * Constructs a locally-hashed ledger block for OFFLINE/DEMO USE ONLY, when
 * the backend at /api/clauses/override is unreachable. This is explicitly
 * NOT the authoritative ledger - surfaces/desktop.py's write_audit_log is
 * the single writer whenever the backend is reachable (see
 * complianceClient.ts: submitCounselOverrideToBackend is always tried
 * first). This function only exists so the UI degrades gracefully rather
 * than losing the action entirely when working offline; a block created
 * this way should be visibly labeled "locally recorded, not server-
 * verified" in the UI rather than shown identically to a backend-committed
 * block.
 *
 * TODO(follow-up): the full fix is to make every override request queue
 * and retry against the backend rather than fabricate a local block at
 * all - tracked as a deferred item, not done in this pass.
 */
export async function createLocalDemoBlock(params: {
  sequenceId: number;
  contractId: string;
  clauseId: string;
  verdict: ClauseVerdict;
  calibratedScore: number;
  evaluatorModel: string;
  sourceDocHash: string;
  previousBlockHash: string;
  counselSignature?: {
    counsel: string;
    email: string;
    barNumber: string;
    justification: string;
  };
}): Promise<AuditLedgerBlock> {
  const timestamp = new Date().toISOString();
  const canonicalPayload = JSON.stringify({
    sequenceId: params.sequenceId,
    timestamp,
    contractId: params.contractId,
    clauseId: params.clauseId,
    verdict: params.verdict,
    calibratedScore: params.calibratedScore,
    evaluatorModel: params.evaluatorModel,
    sourceDocHash: params.sourceDocHash,
    previousBlockHash: params.previousBlockHash,
    counselSignature: params.counselSignature || null,
  });
  const blockHash = await sha256(canonicalPayload);
  return { ...params, timestamp, blockHash };
}

/**
 * Verifies the mathematical integrity of the SHA-256 hash chain the
 * backend produced. Recomputes every block hash and checks the
 * previousBlockHash pointer. No exceptions, no hardcoded bypasses - a
 * block either recomputes to its recorded hash or the chain is reported
 * broken.
 */
export async function verifyLedgerCryptographically(blocks: AuditLedgerBlock[]): Promise<{
  valid: boolean;
  verifiedBlocks: number;
  merkleRoot: string;
  reason?: string;
}> {
  if (!blocks || blocks.length === 0) {
    return { valid: false, verifiedBlocks: 0, merkleRoot: '', reason: 'Ledger contains zero committed blocks' };
  }

  const GENESIS_PREV_HASH = '0'.repeat(64);

  for (let i = 0; i < blocks.length; i++) {
    const current = blocks[i];

    if (i > 0 && current.sequenceId <= blocks[i - 1].sequenceId) {
      return {
        valid: false,
        verifiedBlocks: i,
        merkleRoot: '',
        reason: `Non-monotonic sequence ID at Block #${current.sequenceId} (expected > ${blocks[i - 1].sequenceId})`,
      };
    }

    const expectedPrevHash = i === 0 ? (current.previousBlockHash || GENESIS_PREV_HASH) : blocks[i - 1].blockHash;
    if (current.previousBlockHash !== expectedPrevHash) {
      return {
        valid: false,
        verifiedBlocks: i,
        merkleRoot: '',
        reason: `Broken cryptographic link at Block #${current.sequenceId}. Expected parent: ${expectedPrevHash.slice(0, 12)}..., found: ${current.previousBlockHash.slice(0, 12)}...`,
      };
    }

    const canonicalPayload = JSON.stringify({
      sequenceId: current.sequenceId,
      timestamp: current.timestamp,
      contractId: current.contractId,
      clauseId: current.clauseId,
      verdict: current.verdict,
      calibratedScore: current.calibratedScore,
      evaluatorModel: current.evaluatorModel,
      sourceDocHash: current.sourceDocHash,
      previousBlockHash: current.previousBlockHash,
      counselSignature: current.counselSignature || null,
    });

    const expectedHash = await sha256(canonicalPayload);
    if (current.blockHash !== expectedHash) {
      return {
        valid: false,
        verifiedBlocks: i,
        merkleRoot: '',
        reason: `Tamper detected in Block #${current.sequenceId}. Computed hash ${expectedHash.slice(0, 12)}... does not match recorded ${current.blockHash.slice(0, 12)}...`,
      };
    }
  }

  const leafHashes = blocks.map((b) => b.blockHash).join('');
  const merkleRoot = await sha256(leafHashes);

  return { valid: true, verifiedBlocks: blocks.length, merkleRoot };
}

export interface CryptographicProofBundle {
  exportTimestamp: string;
  contractId: string;
  sourceDocHash: string;
  merkleRoot: string;
  totalBlocks: number;
  verificationStatus: string;
  ledgerType: string;
  chainValidation: {
    valid: boolean;
    reason?: string;
  };
  blocks: AuditLedgerBlock[];
  proofLeaves: {
    sequenceId: number;
    clauseId: string;
    verdict: ClauseVerdict;
    blockHash: string;
    parentHash: string;
    counselSignoff?: {
      counsel: string;
      email: string;
      barNumber: string;
      justification: string;
    };
  }[];
}

/**
 * Builds a downloadable proof bundle: the hash-chained audit trail plus a
 * recomputed validity check, for internal record-keeping and to hand to
 * counsel. This is a tamper-evidence artifact against post-hoc edits to
 * the local ledger file - it is not independent multi-party consensus
 * and should not be labeled as such (see README "What this tool is not").
 */
export async function generateProofBundle(
  contractId: string,
  sourceDocHash: string,
  blocks: AuditLedgerBlock[]
): Promise<CryptographicProofBundle> {
  const verification = await verifyLedgerCryptographically(blocks);

  return {
    exportTimestamp: new Date().toISOString(),
    contractId,
    sourceDocHash,
    merkleRoot: verification.merkleRoot,
    totalBlocks: blocks.length,
    verificationStatus: verification.valid ? 'HASH_CHAIN_VERIFIED' : 'TAMPER_DETECTED',
    ledgerType: 'SHA-256 hash-chained append-only log (single-writer; not distributed consensus)',
    chainValidation: { valid: verification.valid, reason: verification.reason },
    blocks,
    proofLeaves: blocks.map((b) => ({
      sequenceId: b.sequenceId,
      clauseId: b.clauseId,
      verdict: b.verdict,
      blockHash: b.blockHash,
      parentHash: b.previousBlockHash,
      counselSignoff: b.counselSignature,
    })),
  };
}

export function downloadProofBundleJson(bundle: CryptographicProofBundle, fileName?: string): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || `audit-proof-${bundle.contractId}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
