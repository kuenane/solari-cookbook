import { PipelineLogEntry, AuditLedgerBlock, CoverageCell } from '../types';
export type { CoverageCell };
import { verifyLedgerCryptographically } from '../utils/cryptoLedger';
import { signOverride } from '../utils/counselSigning';

export interface AuditStreamEvent {
  event: 'clauses_extracted' | 'node_transition' | 'block_committed' | 'audit_complete';
  data: any;
}

export interface OverridePayload {
  contract_id: string;
  clause_id: string;
  verdict: string;
  counsel_name: string;
  counsel_email: string;
  bar_number: string;
  justification: string;
  signature?: string;
  public_key?: string;
}

const API_BASE = '/api';

/**
 * Health check to verify Python FastAPI / backend status
 */
export async function checkBackendHealth(): Promise<{ online: boolean; info?: any }> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { online: false };
    const data = await res.json();
    return { online: true, info: data };
  } catch {
    return { online: false };
  }
}

/**
 * Submits an authenticated counsel override to the Python backend to
 * commit a SHA-256 block. Signs the payload with this browser's ECDSA
 * counsel-signing key first (see src/utils/counselSigning.ts) - the
 * backend independently re-verifies the signature rather than trusting
 * the plaintext name/bar_number fields alone.
 */
export async function submitCounselOverrideToBackend(payload: OverridePayload): Promise<any> {
  let signed: OverridePayload = payload;
  try {
    const { signature, publicKey } = await signOverride({
      contractId: payload.contract_id,
      clauseId: payload.clause_id,
      verdict: payload.verdict,
      counselName: payload.counsel_name,
      counselEmail: payload.counsel_email,
      barNumber: payload.bar_number,
      justification: payload.justification,
    });
    signed = { ...payload, signature, public_key: publicKey };
  } catch (signErr) {
    console.warn('[Counsel Signing] Could not sign override (Web Crypto unavailable?); submitting unsigned:', signErr);
  }

  try {
    const res = await fetch(`${API_BASE}/clauses/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signed),
    });
    if (!res.ok) {
      throw new Error(`Override request failed with status ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[Backend] Remote override API failed:', err);
    return null;
  }
}

/**
 * Uploads a contract file to the Python backend for authoritative text extraction
 * and clause parsing via DesktopSurface (pypdf).
 */
export async function uploadContract(
  file: File,
  contractId: string = 'contract-001'
): Promise<{
  contract_id: string;
  filename: string;
  source_doc_hash: string;
  clauses: any[];
  total_clauses: number;
} | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('contract_id', contractId);

    const res = await fetch(`${API_BASE}/contracts/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`Contract upload failed with status ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[Backend] Upload error:', err);
    return null;
  }
}

/**
 * Fetches the raw SHA-256 block ledger from the Python backend.
 */
export async function fetchLedgerFromBackend(): Promise<AuditLedgerBlock[] | null> {
  try {
    const res = await fetch(`${API_BASE}/ledger`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.blocks;
  } catch {
    return null;
  }
}

/**
 * Connects to the SSE streaming audit endpoint (`/api/audit/stream/{contract_id}`).
 * Supports automatic reconnection with `last_event_id` tracking to guarantee at-least-once,
 * zero-duplicate pipeline stage delivery.
 */
export function streamAuditFromBackend(
  contractId: string,
  onLog: (log: PipelineLogEntry) => void,
  onBlock: (block: any) => void,
  onComplete: () => void,
  onError: (err: any) => void
): () => void {
  let eventSource: EventSource | null = null;
  let isCancelled = false;
  let lastEventId = 0;
  let retryCount = 0;
  const maxRetries = 3;

  function connect() {
    if (isCancelled) return;

    const url = lastEventId > 0
      ? `${API_BASE}/audit/stream/${contractId}?last_event_id=${lastEventId}`
      : `${API_BASE}/audit/stream/${contractId}`;

    eventSource = new EventSource(url);

    eventSource.addEventListener('clauses_extracted', (e: MessageEvent) => {
      if (e.lastEventId) {
        lastEventId = parseInt(e.lastEventId, 10) || lastEventId;
      }
    });

    eventSource.addEventListener('node_transition', (e: MessageEvent) => {
      if (e.lastEventId) {
        lastEventId = parseInt(e.lastEventId, 10) || lastEventId;
      }
      try {
        const item = JSON.parse(e.data);
        onLog({
          id: `log-stream-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toTimeString().split(' ')[0],
          surface: item.surface || 'sandbox',
          node: item.node || 'langgraph_step',
          level: item.level || 'info',
          message: item.message,
        });
      } catch (err) {
        console.error('Error parsing SSE node_transition', err);
      }
    });

    eventSource.addEventListener('block_committed', (e: MessageEvent) => {
      if (e.lastEventId) {
        lastEventId = parseInt(e.lastEventId, 10) || lastEventId;
      }
      try {
        const item = JSON.parse(e.data);
        onBlock(item.block);
      } catch (err) {
        console.error('Error parsing SSE block_committed', err);
      }
    });

    eventSource.addEventListener('audit_complete', () => {
      onComplete();
      eventSource?.close();
    });

    eventSource.onerror = (err) => {
      eventSource?.close();
      if (!isCancelled && retryCount < maxRetries) {
        retryCount++;
        // Resume from Last-Event-ID after short backoff
        setTimeout(() => {
          if (!isCancelled) {
            connect();
          }
        }, 600 * retryCount);
      } else {
        onError(err);
      }
    };
  }

  connect();

  return () => {
    isCancelled = true;
    eventSource?.close();
  };
}

/**
 * Resets the remote file-backed cryptographic ledger back to genesis blocks #101 and #102.
 */
export async function resetRemoteLedger(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/ledger/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.ok;
  } catch (err) {
    console.warn('[Backend] Could not reset remote ledger:', err);
    return false;
  }
}

/**
 * Invokes cryptographic verification over the SHA-256 hash chain.
 * Fails closed if remote is unreachable AND client-side blocks fail mathematical validation.
 */
export async function verifyLedger(
  clientBlocks?: AuditLedgerBlock[]
): Promise<{ valid: boolean; verified: boolean; status: string; reason?: string; merkleRoot?: string }> {
  // First attempt remote backend validation
  try {
    const res = await fetch(`${API_BASE}/ledger/verify`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const data = await res.json();
      return {
        valid: data.valid,
        verified: data.valid,
        status: data.valid ? 'Remote Backend Validated' : 'Remote Tamper Detected',
        reason: data.reason,
        merkleRoot: data.merkleRoot || data.merkle_root,
      };
    }
  } catch {
    // Remote offline: Proceed to zero-trust client cryptographic verification
  }

  if (clientBlocks && clientBlocks.length > 0) {
    const verification = await verifyLedgerCryptographically(clientBlocks);
    if (!verification.valid) {
      return {
        valid: false,
        verified: false,
        status: 'Cryptographic Chain Severed',
        reason: verification.reason || 'Hash mismatch detected in client blocks',
      };
    }
    return {
      valid: true,
      verified: true,
      status: `Client-Verified (${verification.verifiedBlocks} Blocks Verified)`,
      merkleRoot: verification.merkleRoot,
    };
  }

  // Fail closed if no blocks to verify and backend is offline
  return {
    valid: false,
    verified: false,
    status: 'UNVERIFIED_OFFLINE',
    reason: 'Remote consensus server unreachable and no client blocks supplied for verification',
  };
}

/**
 * Legacy compatibility alias
 */
export const verifyLedgerWithBackend = verifyLedger;

/**
 * Phase 1 fix: fetches REAL, current source file contents from the backend
 * (allowlisted paths only - see /api/source/{path} in server.py) instead
 * of the frozen string copies previously hardcoded in PythonCodeView.tsx.
 */
export async function fetchSource(path: string): Promise<{ path: string; content: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/source/${path}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Phase 0 fix: the review queue as a first-class, fetchable list - every
 * clause flagged for counsel review that hasn't since been resolved.
 */
export interface ReviewQueueItem {
  clause_id: string;
  contract_id: string;
  status: string;
  flagged_at: string;
  block_hash: string;
}

export async function fetchReviewQueue(): Promise<ReviewQueueItem[]> {
  try {
    const res = await fetch(`${API_BASE}/review-queue`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}



export async function fetchCoverageMatrix(): Promise<CoverageCell[]> {
  try {
    const res = await fetch(`${API_BASE}/coverage`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.cells || [];
  } catch {
    return [];
  }
}

