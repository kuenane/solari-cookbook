// Phase 0/5 rename: see src/utils/verdict.ts for the full rationale.
// baseline_met = term-matching found the checked mandatory terms present.
// gaps_flagged = some mandatory terms missing, needs counsel review.
// conflict_or_absent = statutory conflict or clause absent, needs remediation.
// out_of_scope = clause type/jurisdiction not in the coverage matrix - never scored.
export type ClauseVerdict = 'baseline_met' | 'gaps_flagged' | 'conflict_or_absent' | 'out_of_scope';

export type ActiveView =
  | 'contract-overview'
  | 'clauses-breakdown'
  | 'clause-01-audit'
  | 'clause-02-audit'
  | 'clause-03-audit'
  | 'clause-04-audit'
  | 'clause-05-audit'
  | 'compliance-matrix'
  | 'review-queue'
  | 'audit-pipeline-logs'
  | 'merkle-visualizer'
  | 'counterparty-diff'
  | 'python-source'
  | `clause-${string}`
  | string;

export interface CoverageMandatoryTerm {
  term: string;
  provision?: string | null;
  verified: boolean;
  note?: string | null;
}

export interface CoverageCell {
  jurisdiction: string;
  topic: string;
  tier: 'P0' | 'P1' | 'P2';
  law_code: string;
  source_url: string;
  badge?: string | null;
  note?: string | null;
  statute_retrieved_at?: string | null;
  mandatory_terms?: CoverageMandatoryTerm[];
}

export interface ClauseData {
  id: string;
  clauseNumber: string;
  title: string;
  topic: string;
  jurisdiction: string;
  jurisdictions?: string[]; // Multi-sovereign tags, e.g. ['ZA', 'LS']
  dualSovereignAudit?: {
    primaryStatute: {
      jurisdiction: string;
      regulation: string;
      status: 'CONFORMANT' | 'FLAGGED' | 'CONDITIONAL';
      verdictScore: number;
      citation: string;
    };
    secondaryStatute: {
      jurisdiction: string;
      regulation: string;
      status: 'CONFORMANT' | 'FLAGGED' | 'CONDITIONAL';
      verdictScore: number;
      citation: string;
    };
    bilateralHarmonizationVerdict: 'ALIGNED' | 'REQUIRES_AMENDMENT' | 'CONFLICTING_STANDARD';
  };
  lines: string;
  originalText: string;
  highlightedText: string;
  lengthChars: number;
  verdict: ClauseVerdict;
  verdictLabel: string;
  confidence: number;
  targetThreshold: number;
  variance: number;
  latencyMs: number;
  retries: number;
  tokens: number;
  model: string;
  temperature: number;
  pipelineStages: {
    retrieve: {
      status: 'Fetched' | 'Pending' | 'Error';
      source: string;
      regulation: string;
    };
    match: {
      status: 'Warning' | 'Passed' | 'Failed';
      matched: boolean;
      confidence: number;
      model: string;
    };
    reflect: {
      status: 'Flagged' | 'Sound' | 'Warning';
      soundness: boolean;
      notes: string;
    };
    score: {
      status: 'Amber Review' | 'Verified' | 'Passed' | 'Failed';
      verdict: ClauseVerdict;
      actionRequired: string;
    };
  };
  differential: {
    currentClauseExcerpt: string;
    currentClauseEvaluation: string;
    currentClauseDefects: string;
    benchmarkTitle: string;
    benchmarkUrl: string;
    benchmarkExcerpt: string;
    benchmarkStandard: string;
  };
  reflection: {
    soundness: boolean;
    findingTitle: string;
    critique: string;
    ambiguityPenalty: number;
    jurisdictionalSpecificity: string;
    semanticDriftRisk: 'Low' | 'Moderate' | 'Elevated' | 'Critical';
  };
  referenceVector: {
    vectorId: string;
    endpoint: string;
    safeHarbor: 'SATISFIED' | 'NOT SATISFIED' | 'PARTIAL';
    mandatoryClauses: string;
  };
  triageHistory?: Array<{
    action: string;
    timestamp: string;
    counsel: string;
    notes?: string;
    counselEmail?: string;
    barCredential?: string;
    preOverrideVerdict?: string;
    postOverrideVerdict?: string;
    blockHash?: string;
    previousBlockHash?: string;
  }>;
  cryptographicReceipt?: {
    blockHash: string;
    previousBlockHash: string;
    sourceDocSha256?: string;
    calibratedScore?: number;
    tamperEvident?: boolean;
    sequenceId?: number;
    timestamp?: string;
    counselSignature?: {
      counsel: string;
      email: string;
      barNumber: string;
      justification: string;
    };
  };
}

export interface PipelineLogEntry {
  id: string;
  timestamp: string;
  surface: 'desktop' | 'browser' | 'sandbox' | 'langgraph';
  node: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  metadata?: Record<string, any>;
  blockHash?: string;
}

export interface AuditLedgerBlock {
  sequenceId: number;
  timestamp: string;
  contractId: string;
  clauseId: string;
  verdict: ClauseVerdict;
  calibratedScore: number;
  evaluatorModel: string;
  sourceDocHash: string;
  previousBlockHash: string;
  blockHash: string;
  counselSignature?: {
    counsel: string;
    email: string;
    barNumber: string;
    justification: string;
  };
}
