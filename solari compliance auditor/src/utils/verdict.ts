import { ClauseVerdict } from '../types';

/**
 * Phase 0/5 fix: the old verdict strings ('baseline_met', 'baseline_met', 'conflict_or_absent',
 * 'conflict_or_absent', 'gaps_flagged') read to a non-technical reviewer as a compliance
 * certification - "Verified" implies "this contract is compliant", which
 * this tool cannot actually determine (see README "What this tool is
 * not"). ClauseVerdict is now CoverageStatus vocabulary: it can only mean
 * what the pipeline actually does - keyword/LLM-blended term-matching
 * against a named, dated statute.
 *
 * Every place that used to interpolate `clause.verdict` directly into the
 * UI, or do substring matching like `.includes('verified')`, should use
 * these helpers instead so the wording and the logic stay in one place.
 */

export function isBaselineMet(v: ClauseVerdict | string | undefined): boolean {
  return v === 'baseline_met';
}

export function isGapsFlagged(v: ClauseVerdict | string | undefined): boolean {
  return v === 'gaps_flagged';
}

export function isConflictOrAbsent(v: ClauseVerdict | string | undefined): boolean {
  return v === 'conflict_or_absent';
}

export function isOutOfScope(v: ClauseVerdict | string | undefined): boolean {
  return v === 'out_of_scope' || !v;
}

export function verdictLabel(v: ClauseVerdict | string | undefined): string {
  switch (v) {
    case 'baseline_met':
      return 'Coverage: Meets baseline';
    case 'gaps_flagged':
      return 'Coverage: Gaps flagged';
    case 'conflict_or_absent':
      return 'Coverage: Statutory conflict';
    case 'out_of_scope':
    default:
      return 'Not evaluated - out of scope';
  }
}

export function verdictShortLabel(v: ClauseVerdict | string | undefined): string {
  switch (v) {
    case 'baseline_met':
      return 'Baseline Met';
    case 'gaps_flagged':
      return 'Gaps Flagged';
    case 'conflict_or_absent':
      return 'Conflict/Absent';
    case 'out_of_scope':
    default:
      return 'Out of Scope';
  }
}

/** Tailwind text/border color classes matching the existing green/amber/red scheme. */
export function verdictColorClasses(v: ClauseVerdict | string | undefined): string {
  switch (v) {
    case 'baseline_met':
      return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    case 'gaps_flagged':
      return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    case 'conflict_or_absent':
      return 'text-red-400 border-red-500/40 bg-red-500/10';
    case 'out_of_scope':
    default:
      return 'text-slate-400 border-slate-500/40 bg-slate-500/10';
  }
}

/** Coverage-tier badge text, keyed by (jurisdiction, topic) via /api/coverage - see CoverageCell. */
export function tierBadgeClasses(tier: 'P0' | 'P1' | 'P2' | null | undefined): string {
  switch (tier) {
    case 'P0':
      return 'text-emerald-300 border-emerald-500/30';
    case 'P1':
      return 'text-amber-300 border-amber-500/30';
    case 'P2':
      return 'text-orange-300 border-orange-500/30';
    default:
      return 'text-slate-400 border-slate-500/30';
  }
}

/** Evaluates overall contract screening status across all clause verdicts without certification claims. */
export function getOverallScreeningStatus(verdicts: (ClauseVerdict | string | undefined)[]): {
  statusText: string;
  statusType: 'red' | 'amber' | 'green';
} {
  if (verdicts.some((v) => v === 'conflict_or_absent')) {
    return {
      statusText: 'Coverage Screening: Statutory Conflicts Detected',
      statusType: 'red',
    };
  }
  if (verdicts.some((v) => v === 'gaps_flagged')) {
    return {
      statusText: 'Coverage Screening: Statutory Gaps Flagged',
      statusType: 'amber',
    };
  }
  return {
    statusText: 'Coverage Screening: All Checked Baselines Met',
    statusType: 'green',
  };
}
