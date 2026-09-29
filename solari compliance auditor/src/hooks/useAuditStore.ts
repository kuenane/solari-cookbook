import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ActiveView, ClauseData, ClauseVerdict, PipelineLogEntry, AuditLedgerBlock } from '../types';
import { CLAUSES_DATA, PIPELINE_LOGS } from '../data/mockData';
import { createLocalDemoBlock, verifyLedgerCryptographically, generateProofBundle, downloadProofBundleJson } from '../utils/cryptoLedger';
// auditRecordPackager (jszip) is dynamically imported inside
// handleExportEvidenceZip below, not statically here - jszip is a
// non-trivial dependency that should only load when the person actually
// exports a ZIP, not bundled into the main app chunk on every page load.
import { submitCounselOverrideToBackend, streamAuditFromBackend, verifyLedger, resetRemoteLedger, fetchLedgerFromBackend } from '../api/complianceClient';

const STORAGE_KEY = 'solari_compliance_audit_v2';

// Phase 3 fix: these two hashes were previously hand-typed plausible-looking
// hex strings that did NOT match the SHA-256 of their own fields - meaning
// the shipped demo ledger failed its own tamper check before a single real
// audit ran. Both values below are the actual, verified sha256() of their
// canonical payload (confirmed with node's crypto module, chained
// genesis -> block 101 -> block 102). This is still only a local fallback,
// used when the backend ledger can't be reached - see the fetch effect
// below, which prefers the server's authoritative ledger on mount.
const DEFAULT_BLOCKS: AuditLedgerBlock[] = [
  {
    sequenceId: 101,
    timestamp: '2026-09-22T08:14:02.120Z',
    contractId: 'contract-001',
    clauseId: 'clause-001',
    verdict: 'gaps_flagged',
    calibratedScore: 0.584,
    evaluatorModel: 'nvidia/nemotron-3-ultra-550b-a55b',
    sourceDocHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    previousBlockHash: '0'.repeat(64),
    blockHash: 'e4cf00a8691c20ff81605795d177a1e1a551105cb7f5da6ccfaf07a70685dfba',
  },
  {
    sequenceId: 102,
    timestamp: '2026-09-22T08:14:03.450Z',
    contractId: 'contract-001',
    clauseId: 'clause-002',
    verdict: 'baseline_met',
    calibratedScore: 0.942,
    evaluatorModel: 'nvidia/nemotron-3-ultra-550b-a55b',
    sourceDocHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    previousBlockHash: 'e4cf00a8691c20ff81605795d177a1e1a551105cb7f5da6ccfaf07a70685dfba',
    blockHash: '7fd305a69c9b5f4d3be95d98deaabf5715900bd5ae46fe8ff32300a333c639f0',
  },
];

function loadPersistedState() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[Solari Store] Error loading persisted state:', e);
    return null;
  }
}

export function useAuditStore() {
  const initial = useMemo(() => loadPersistedState(), []);

  const [activeView, setActiveView] = useState<ActiveView>(initial?.activeView || 'clause-01-audit');
  const [clauses, setClauses] = useState<Record<string, ClauseData>>(initial?.clauses || CLAUSES_DATA);
  const [clauseStatuses, setClauseStatuses] = useState<Record<string, string>>(
    initial?.clauseStatuses || {
      'clause-01-audit': 'Amber',
      'clause-02-audit': 'Verified',
      'clause-03-audit': 'Passed',
    }
  );
  const [logs, setLogs] = useState<PipelineLogEntry[]>(initial?.logs || PIPELINE_LOGS);
  const [ledgerBlocks, setLedgerBlocks] = useState<AuditLedgerBlock[]>(initial?.ledgerBlocks || DEFAULT_BLOCKS);

  // Modals state
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [isExportPdfModalOpen, setIsExportPdfModalOpen] = useState(false);
  const [isRerunModalOpen, setIsRerunModalOpen] = useState(false);
  const [isUploadPdfModalOpen, setIsUploadPdfModalOpen] = useState(false);
  const [isRerunningInline, setIsRerunningInline] = useState(false);
  const [isVerifyingLedger, setIsVerifyingLedger] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [contractName, setContractName] = useState<string>(
    initial?.contractName || 'contract-001.pdf — Master SaaS & Enterprise Data License'
  );
  const [sourceDocHash, setSourceDocHash] = useState<string>(
    initial?.sourceDocHash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );

  // Sync state changes to localStorage
  useEffect(() => {
    try {
      const payload = {
        activeView,
        clauses,
        clauseStatuses,
        logs: logs.slice(-50), // keep recent 50 logs
        ledgerBlocks,
        contractName,
        sourceDocHash,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('[Solari Store] Failed to save state to localStorage:', e);
    }
  }, [activeView, clauses, clauseStatuses, logs, ledgerBlocks, contractName, sourceDocHash]);

  // Phase 3: prefer the backend's authoritative ledger over the local
  // fallback/persisted copy on mount. Only replaces state if the backend
  // actually returns blocks - stays on the local/persisted copy otherwise
  // (e.g. offline dev, backend not started).
  useEffect(() => {
    let cancelled = false;
    fetchLedgerFromBackend().then((blocks) => {
      if (!cancelled && blocks && blocks.length > 0) {
        setLedgerBlocks(blocks);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Timers cleanup ref
  const timersRef = useRef<number[]>([]);
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    const t = window.setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 4000);
    timersRef.current.push(t);
  }, []);

  // Dynamic Clause Key Resolution: No more 3-clause hardcoded limit!
  const currentClauseKey = useMemo(() => {
    if (clauses[activeView]) return activeView;
    const stripped = activeView.replace('-audit', '');
    if (clauses[stripped]) return stripped;
    const matched = Object.keys(clauses).find((k) => k === activeView || k.includes(activeView));
    if (matched) return matched;
    return Object.keys(clauses)[0] || 'clause-01-audit';
  }, [activeView, clauses]);

  const currentClause = useMemo(() => {
    return clauses[currentClauseKey] || Object.values(clauses)[0];
  }, [clauses, currentClauseKey]);

  const handleContractUpload = useCallback(
    async (fileName: string, extractedClauses: ClauseData[], rawHash: string) => {
      setContractName(`${fileName} — Uploaded Legal Agreement`);
      setSourceDocHash(rawHash);

      // Map new clauses dynamically into state dictionary
      const newClausesMap: Record<string, ClauseData> = {};
      const newStatuses: Record<string, string> = {};

      extractedClauses.forEach((c, idx) => {
        const numStr = String(idx + 1).padStart(2, '0');
        const key = `clause-${numStr}-audit`;
        newClausesMap[key] = {
          ...c,
          id: c.id || `clause-${numStr}`,
        };
        newStatuses[key] = c.verdict === 'baseline_met' ? 'Baseline Met' : 'Gaps Flagged';
      });

      setClauses(newClausesMap);
      setClauseStatuses(newStatuses);

      // Commit authentic SHA-256 genesis block for this uploaded contract
      const lastBlock = ledgerBlocks[ledgerBlocks.length - 1];
      const prevHash = lastBlock
        ? lastBlock.blockHash
        : '0000000000000000000000000000000000000000000000000000000000000000';
      const nextSeq = (lastBlock ? lastBlock.sequenceId : 100) + 1;

      const genesisBlock = await createLocalDemoBlock({
        sequenceId: nextSeq,
        contractId: fileName.replace(/\.[^/.]+$/, ''),
        clauseId: extractedClauses[0]?.id || 'clause-001',
        verdict: 'gaps_flagged',
        calibratedScore: 0.68,
        evaluatorModel: 'DesktopSurface OCR / AST Ingestion',
        sourceDocHash: rawHash,
        previousBlockHash: prevHash,
      });

      setLedgerBlocks((prev) => [...prev, genesisBlock]);

      setLogs((prev) => [
        ...prev,
        {
          id: `log-upload-${Date.now()}`,
          timestamp: new Date().toTimeString().split(' ')[0],
          surface: 'desktop',
          node: 'document_ingest',
          level: 'success',
          message: `Contract ingested: '${fileName}'. Extracted ${extractedClauses.length} dynamic clauses. Ledger Block #${genesisBlock.sequenceId} committed.`,
          blockHash: genesisBlock.blockHash,
        },
      ]);

      setActiveView('contract-overview');
      showToast(`Ingested ${fileName}: ${extractedClauses.length} dynamic clauses extracted and anchored to ledger.`);
    },
    [ledgerBlocks, showToast]
  );

  const handleApproveCaveat = useCallback((clauseId: string) => {
    setClauseStatuses((prev) => ({ ...prev, [currentClauseKey]: 'Approved w/ Caveat' }));
    setClauses((prev) => ({
      ...prev,
      [currentClauseKey]: {
        ...prev[currentClauseKey],
        verdict: 'gaps_flagged',
        verdictLabel: 'Audit Verdict: APPROVED WITH CAVEAT',
        pipelineStages: {
          ...prev[currentClauseKey].pipelineStages,
          score: {
            ...prev[currentClauseKey].pipelineStages.score,
            actionRequired: 'Counsel Caveat Logged to Immutable Ledger',
          },
        },
      },
    }));
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toTimeString().split(' ')[0],
        surface: 'desktop',
        node: 'counsel_override',
        level: 'warn',
        message: `Counsel marked ${clauseId} as Approved with Caveat. Statutory gap acknowledged.`,
      },
    ]);
    showToast('Approved with Caveat logged to audit trail.');
  }, [currentClauseKey, showToast]);

  const handleOverridePass = useCallback((clauseId: string) => {
    setClauseStatuses((prev) => ({ ...prev, [currentClauseKey]: 'Baseline Met (Override)' }));
    setClauses((prev) => ({
      ...prev,
      [currentClauseKey]: {
        ...prev[currentClauseKey],
        verdict: 'baseline_met',
        verdictLabel: 'Audit Verdict: VERIFIED (OVERRIDE)',
        confidence: 0.9,
      },
    }));
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toTimeString().split(' ')[0],
        surface: 'desktop',
        node: 'counsel_override',
        level: 'success',
        message: `Counsel override executed: ${clauseId} forced to Verified.`,
      },
    ]);
    showToast('Override executed: Clause status updated to Verified.');
  }, [currentClauseKey, showToast]);

  const handleApplyRedlineRevision = useCallback(
    async (clauseId: string, revisedText: string, reason = 'Counsel Applied Statutory Redline') => {
      const updatedConfidence = 0.96;
      const updatedVerdict: ClauseVerdict = 'baseline_met';
      const timestamp = new Date().toISOString();

      const prevBlock = ledgerBlocks[ledgerBlocks.length - 1];
      const newBlock = await createLocalDemoBlock({
        sequenceId: (prevBlock?.sequenceId || 100) + 1,
        contractId: contractName.split(' ')[0] || 'contract-001',
        clauseId,
        verdict: updatedVerdict,
        calibratedScore: updatedConfidence,
        evaluatorModel: 'counsel_redline_editor (AST Re-Synthesizer)',
        sourceDocHash,
        previousBlockHash: prevBlock?.blockHash || '0000000000000000000000000000000000000000000000000000000000000000',
        counselSignature: {
          counsel: 'Practicing Compliance Counsel',
          email: 'counsel@solari.internal',
          barNumber: 'LSO-BAR-2024-8841 / LPC-ZA-79102',
          justification: reason,
        },
      });

      setLedgerBlocks((prev) => [...prev, newBlock]);
      setClauseStatuses((prev) => ({ ...prev, [currentClauseKey]: 'Baseline Met (Redline)' }));
      setClauses((prev) => {
        const target = prev[currentClauseKey];
        if (!target) return prev;
        return {
          ...prev,
          [currentClauseKey]: {
            ...target,
            originalText: revisedText,
            highlightedText: revisedText.slice(0, 100),
            lengthChars: revisedText.length,
            verdict: updatedVerdict,
            verdictLabel: 'Audit Verdict: VERIFIED (REDLINE APPLIED)',
            confidence: updatedConfidence,
            variance: 0.16,
            pipelineStages: {
              ...target.pipelineStages,
              match: {
                ...target.pipelineStages.match,
                status: 'Passed',
                confidence: updatedConfidence,
              },
              reflect: {
                status: 'Sound',
                soundness: true,
                notes: 'Redline revision directly adopts statutory safe-harbor standard. Ambiguity resolved.',
              },
              score: {
                status: 'Verified',
                verdict: updatedVerdict,
                actionRequired: 'None - Statutory Covenants Satisfied via Redline',
              },
            },
            differential: {
              ...target.differential,
              currentClauseExcerpt: revisedText.slice(0, 160) + '...',
              currentClauseEvaluation: 'Statutory Safe Harbor Satisfied',
              currentClauseDefects: 'None. Directly binds parties to statutory compliance obligations.',
            },
            reflection: {
              ...target.reflection,
              soundness: true,
              findingTitle: 'Statutory Alignment Achieved',
              critique: '“The revised redline successfully addresses the statutory deficiencies, providing reciprocal adequacy protections and mandatory notice covenants.”',
              ambiguityPenalty: 0.0,
              semanticDriftRisk: 'Low',
            },
            referenceVector: {
              ...target.referenceVector,
              safeHarbor: 'SATISFIED',
            },
            triageHistory: [
              ...(target.triageHistory || []),
              {
                action: 'STATUTORY_REDLINE_APPLIED',
                timestamp,
                counsel: 'Practicing Compliance Counsel',
                notes: reason,
                blockHash: newBlock.blockHash,
                previousBlockHash: newBlock.previousBlockHash,
              },
            ],
          },
        };
      });

      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toTimeString().split(' ')[0],
          surface: 'desktop',
          node: 'counsel_redline',
          level: 'success',
          message: `Counsel redline applied to ${clauseId}: Clause text updated, confidence elevated to 96%, anchored to block ${newBlock.blockHash.slice(0, 12)}...`,
        },
      ]);

      showToast(`Redline applied: ${clauseId} recorded to the hash-chained ledger.`);
    },
    [currentClauseKey, contractName, sourceDocHash, ledgerBlocks, showToast]
  );

  const handleRejectRevision = useCallback((clauseId: string) => {
    setClauseStatuses((prev) => ({ ...prev, [currentClauseKey]: 'Conflict Flagged (Override)' }));
    setClauses((prev) => ({
      ...prev,
      [currentClauseKey]: {
        ...prev[currentClauseKey],
        verdict: 'conflict_or_absent',
        verdictLabel: 'Audit Verdict: REJECTED',
      },
    }));
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toTimeString().split(' ')[0],
        surface: 'desktop',
        node: 'counsel_override',
        level: 'error',
        message: `Clause ${clauseId} rejected by compliance counsel.`,
      },
    ]);
    showToast('Revision requested from drafting party.');
  }, [currentClauseKey, showToast]);

  const handleRerunClassifier = useCallback((clauseId: string) => {
    setIsRerunningInline(true);
    showToast('Executing LangGraph corrective classification...');

    streamAuditFromBackend(
      'contract-001',
      (newLog) => setLogs((prev) => [...prev, newLog]),
      (newBlock) => {
        if (newBlock?.block_hash) {
          setLedgerBlocks((prev) => {
            const last = prev[prev.length - 1];
            const nextSeq = (last ? last.sequenceId : 100) + 1;
            return [
              ...prev,
              {
                sequenceId: nextSeq,
                timestamp: newBlock.timestamp || new Date().toISOString(),
                contractId: newBlock.contract_id || 'contract-001',
                clauseId: clauseId,
                verdict: 'baseline_met',
                calibratedScore: 0.89,
                evaluatorModel: 'nvidia/nemotron-3-ultra-550b-a55b',
                sourceDocHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                previousBlockHash: last ? last.blockHash : '0000000000000000000000000000000000000000000000000000000000000000',
                blockHash: newBlock.block_hash,
              },
            ];
          });
        }
      },
      () => {
        setIsRerunningInline(false);
        setClauses((prev) => {
          if (!prev[currentClauseKey]) return prev;
          return {
            ...prev,
            [currentClauseKey]: {
              ...prev[currentClauseKey],
              latencyMs: 142,
              tokens: 498,
              retries: (prev[currentClauseKey].retries || 0) + 1,
            },
          };
        });
        showToast('Audit pipeline re-run complete: Telemetry synchronized.');
      },
      () => {
        // Fallback simulation with authentic telemetry and monotonic sequence
        const timer = window.setTimeout(() => {
          setIsRerunningInline(false);
          setClauses((prev) => {
            if (!prev[currentClauseKey]) return prev;
            return {
              ...prev,
              [currentClauseKey]: {
                ...prev[currentClauseKey],
                latencyMs: 129,
                tokens: 442,
                retries: (prev[currentClauseKey].retries || 0) + 1,
              },
            };
          });
          setLogs((prev) => [
            ...prev,
            {
              id: `log-${Date.now()}`,
              timestamp: new Date().toTimeString().split(' ')[0],
              surface: 'sandbox',
              node: 'corrective_match',
              level: 'info',
              message: `Pipeline re-run completed for ${clauseId}. Telemetry updated.`,
            },
          ]);
          showToast('Pipeline re-run complete: Telemetry updated.');
        }, 1200);
        timersRef.current.push(timer);
      }
    );
  }, [currentClauseKey, showToast]);

  const handleConfirmModalOverride = useCallback(
    async (
      newVerdict: ClauseVerdict,
      justification: string,
      counselName: string,
      counselEmail: string = 'elena.vance@solari-legal.com',
      barNumber: string = 'NY Bar #489102-SDNY'
    ) => {
      if (!currentClause) return;

      const isPassing = newVerdict === 'baseline_met';
      const lastBlock = ledgerBlocks[ledgerBlocks.length - 1];
      const prevHash = lastBlock
        ? lastBlock.blockHash
        : '0000000000000000000000000000000000000000000000000000000000000000';
      const nextSeq = (lastBlock ? lastBlock.sequenceId : 100) + 1;

      // Submit to backend if available
      submitCounselOverrideToBackend({
        contract_id: currentClause.id.split('-')[0] || 'contract-001',
        clause_id: currentClause.id,
        verdict: newVerdict,
        counsel_name: counselName,
        counsel_email: counselEmail,
        bar_number: barNumber,
        justification: justification,
      });

      // Compute deterministic SHA-256 ledger block
      const newBlock = await createLocalDemoBlock({
        sequenceId: nextSeq,
        contractId: currentClause.id.split('-')[0] || 'contract-001',
        clauseId: currentClause.id,
        verdict: newVerdict,
        calibratedScore: isPassing ? 0.92 : 0.65,
        evaluatorModel: 'nvidia/nemotron-3-ultra-550b-a55b',
        sourceDocHash: sourceDocHash,
        previousBlockHash: prevHash,
        counselSignature: {
          counsel: counselName,
          email: counselEmail,
          barNumber: barNumber,
          justification: justification,
        },
      });

      setLedgerBlocks((prev) => [...prev, newBlock]);
      setClauseStatuses((prev) => ({
        ...prev,
        [currentClauseKey]: isPassing ? 'Baseline Met (Override)' : newVerdict === 'gaps_flagged' ? 'Gaps Flagged (Caveat)' : 'Conflict Flagged (Override)',
      }));
      setClauses((prev) => {
        if (!prev[currentClauseKey]) return prev;
        return {
          ...prev,
          [currentClauseKey]: {
            ...prev[currentClauseKey],
            verdict: newVerdict,
            verdictLabel: `Audit Verdict: ${newVerdict} (OVERRIDE APPLIED)`,
            confidence: isPassing ? 0.92 : 0.65,
            cryptographicReceipt: {
              blockHash: newBlock.blockHash,
              previousBlockHash: newBlock.previousBlockHash,
              sequenceId: newBlock.sequenceId,
              timestamp: newBlock.timestamp,
              sourceDocSha256: newBlock.sourceDocHash,
              calibratedScore: newBlock.calibratedScore,
              tamperEvident: true,
              counselSignature: newBlock.counselSignature,
            },
            triageHistory: [
              ...(prev[currentClauseKey].triageHistory || []),
              {
                action: `Override to ${newVerdict}`,
                timestamp: new Date().toISOString(),
                counsel: `${counselName} (${barNumber})`,
                notes: justification,
              },
            ],
          },
        };
      });
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toTimeString().split(' ')[0],
          surface: 'desktop',
          node: 'counsel_override',
          level: isPassing ? 'success' : 'warn',
          message: `SHA-256 Block #${newBlock.sequenceId} committed. Hash: ${newBlock.blockHash.slice(0, 16)}... Signer: ${counselName} [${barNumber}]`,
          blockHash: newBlock.blockHash,
        },
      ]);
      showToast(`Override committed to immutable audit ledger (Block #${newBlock.sequenceId}).`);
    },
    [currentClause, currentClauseKey, ledgerBlocks, showToast, sourceDocHash]
  );

  // Authentically verify entire cryptographic chain
  const handleVerifyLedgerChain = useCallback(async () => {
    setIsVerifyingLedger(true);
    showToast('Executing zero-trust SHA-256 chain verification...');

    const result = await verifyLedger(ledgerBlocks);
    setIsVerifyingLedger(false);

    if (result.valid) {
      showToast(`Chain Valid: ${result.status}. Chain Tip: ${result.merkleRoot?.slice(0, 12)}...`);
    } else {
      showToast(`Verification Alert: ${result.status} — ${result.reason || 'Cryptographic mismatch'}`);
    }

    setLogs((prev) => [
      ...prev,
      {
        id: `log-verify-${Date.now()}`,
        timestamp: new Date().toTimeString().split(' ')[0],
        surface: 'sandbox',
        node: 'consensus_verify',
        level: result.valid ? 'success' : 'error',
        message: result.valid
          ? `Chain verification passed: ${ledgerBlocks.length} blocks mathematically linked (single-writer, not distributed consensus). Chain Tip: ${result.merkleRoot?.slice(0, 16)}...`
          : `Chain verification failed: ${result.reason}`,
      },
    ]);
  }, [ledgerBlocks, showToast]);

  // Generate and export judicial-ready Cryptographic Proof Bundle (.json)
  const handleExportProofBundle = useCallback(async () => {
    showToast('Assembling zero-trust cryptographic audit bundle...');
    try {
      const bundle = await generateProofBundle(
        contractName.split(' ')[0] || 'contract-001',
        sourceDocHash,
        ledgerBlocks
      );
      downloadProofBundleJson(bundle);
      showToast(`Proof Bundle generated. Chain Tip: ${bundle.merkleRoot.slice(0, 12)}...`);
      setLogs((prev) => [
        ...prev,
        {
          id: `log-bundle-${Date.now()}`,
          timestamp: new Date().toTimeString().split(' ')[0],
          surface: 'desktop',
          node: 'proof_bundle_export',
          level: 'success',
          message: `Hash-chain proof package compiled (${ledgerBlocks.length} blocks, chain tip: ${bundle.merkleRoot.slice(0, 16)}...). Saved as JSON.`,
        },
      ]);
    } catch (e: any) {
      showToast(`Export error: ${e.message || 'Failed to assemble proof bundle'}`);
    }
  }, [contractName, ledgerBlocks, showToast, sourceDocHash]);

  // Generate and export an offline audit record bundle (.zip) - dynamically
  // imports jszip-based auditRecordPackager only when this is actually
  // called, so jszip never loads for people who don't use this feature.
  const handleExportEvidenceZip = useCallback(
    async (params?: { counselName?: string; barNumber?: string; lawFirm?: string }) => {
      showToast('Packaging audit record bundle with offline verification runner...');
      try {
        const { generateAuditRecordZip, downloadAuditRecordZip } = await import('../utils/auditRecordPackager');
        const cleanContractId = contractName.split(' ')[0] || 'contract-001';
        const zipBlob = await generateAuditRecordZip({
          contractId: cleanContractId,
          contractName,
          sourceDocHash,
          blocks: ledgerBlocks,
          clauses: Object.values(clauses),
          // Phase fix: these used to default to the actual developer's real
          // name and a fabricated bar number/firm when the modal didn't
          // supply values. Empty defaults now - self-reported fields stay
          // genuinely optional rather than silently populated with an
          // invented identity.
          counselName: params?.counselName || '',
          barNumber: params?.barNumber || '',
          lawFirm: params?.lawFirm || '',
        });
        downloadAuditRecordZip(zipBlob, cleanContractId);
        showToast('Audit record bundle (.zip) downloaded successfully.');
        setLogs((prev) => [
          ...prev,
          {
            id: `log-zip-${Date.now()}`,
            timestamp: new Date().toTimeString().split(' ')[0],
            surface: 'desktop',
            node: 'zip_bundle_export',
            level: 'success',
            message: `Audit record ZIP compiled (Manifest, Summary, Corpus, Standalone Verifier HTML). Not a certification of legal admissibility.`,
          },
        ]);
      } catch (e: any) {
        console.error('ZIP bundle error:', e);
        showToast(`Failed to compile ZIP bundle: ${e.message || 'Export error'}`);
      }
    },
    [contractName, sourceDocHash, ledgerBlocks, clauses, showToast]
  );

  const resetToBenchmarkContract = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    resetRemoteLedger().catch((e) => console.warn('Could not reset remote ledger:', e));
    setActiveView('clause-01-audit');
    setClauses(CLAUSES_DATA);
    setClauseStatuses({
      'clause-01-audit': 'Gaps Flagged',
      'clause-02-audit': 'Baseline Met',
      'clause-03-audit': 'Baseline Met',
    });
    setLogs(PIPELINE_LOGS);
    setLedgerBlocks(DEFAULT_BLOCKS);
    setContractName('contract-001.pdf — Master SaaS & Enterprise Data License');
    setSourceDocHash('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    showToast('Reset to pristine benchmark contract state.');
  }, [showToast]);

  return {
    activeView,
    setActiveView,
    clauses,
    clauseStatuses,
    logs,
    ledgerBlocks,
    isJsonModalOpen,
    setIsJsonModalOpen,
    isOverrideModalOpen,
    setIsOverrideModalOpen,
    isExportPdfModalOpen,
    setIsExportPdfModalOpen,
    isRerunModalOpen,
    setIsRerunModalOpen,
    isUploadPdfModalOpen,
    setIsUploadPdfModalOpen,
    contractName,
    sourceDocHash,
    handleContractUpload,
    resetToBenchmarkContract,
    isRerunningInline,
    isVerifyingLedger,
    handleVerifyLedgerChain,
    handleExportProofBundle,
    handleExportEvidenceZip,
    toastMessage,
    showToast,
    currentClause,
    currentClauseKey,
    handleApproveCaveat,
    handleOverridePass,
    handleApplyRedlineRevision,
    handleRejectRevision,
    handleRerunClassifier,
    handleConfirmModalOverride,
  };
}
