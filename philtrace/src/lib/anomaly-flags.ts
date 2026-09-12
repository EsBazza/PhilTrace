import type { Project } from '@prisma/client';

export interface AnomalyFlags {
  flagStalled: boolean;
  flagNeverStarted: boolean;
  flagOverdue: boolean;
  flagOverpaid: boolean;
  flagPaymentPending: boolean;
}

const STALLED_DAYS = 180;

/**
 * Compute anomaly flags for a project.
 * Two-tier system:
 * - Anomaly flags (counted in choropleth density): stalled, neverStarted, overdue, overpaid
 * - Informational flags (shown on detail page only): paymentPending
 */
export function computeAnomalyFlags(
  project: Pick<Project, 'status' | 'progress' | 'startDate' | 'completionDate' | 'amountPaid' | 'budgetPHP'>,
  latestUpdate: { createdAt: Date } | null,
  commentCount: number
): AnomalyFlags {
  const now = new Date();

  // flagStalled: On-Going, no agency update in 180+ days, progress unchanged
  const daysSinceUpdate = latestUpdate
    ? (now.getTime() - new Date(latestUpdate.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;
  const flagStalled =
    project.status === 'On-Going' &&
    daysSinceUpdate >= STALLED_DAYS;

  // flagNeverStarted: start date passed, progress = 0, no comments
  const flagNeverStarted =
    new Date(project.startDate) < now &&
    project.progress === 0 &&
    commentCount === 0;

  // flagOverdue: completion date passed, not completed
  const flagOverdue =
    project.completionDate !== null &&
    new Date(project.completionDate) < now &&
    project.status !== 'Completed';

  // flagOverpaid: progress < 30, amountPaid > 0, amountPaid > 80% of budget
  const flagOverpaid =
    project.progress < 30 &&
    project.amountPaid > 0 &&
    project.amountPaid > 0.8 * project.budgetPHP;

  // flagPaymentPending: informational only - progress = 100, amountPaid = 0
  const flagPaymentPending =
    project.progress === 100 &&
    project.amountPaid === 0;

  return {
    flagStalled,
    flagNeverStarted,
    flagOverdue,
    flagOverpaid,
    flagPaymentPending,
  };
}

/**
 * Get the list of active anomaly flag names (excluding informational flags).
 */
export function getActiveAnomalyFlags(flags: AnomalyFlags): string[] {
  const result: string[] = [];
  if (flags.flagStalled) result.push('Stalled');
  if (flags.flagNeverStarted) result.push('Never Started');
  if (flags.flagOverdue) result.push('Overdue');
  if (flags.flagOverpaid) result.push('Overpaid');
  return result;
}

/**
 * Get all active flag names including informational.
 */
export function getAllActiveFlags(flags: AnomalyFlags): string[] {
  const result = getActiveAnomalyFlags(flags);
  if (flags.flagPaymentPending) result.push('Payment Pending');
  return result;
}

export interface RiskScoreTier {
  label: string;
  color: string;
  badgeClass: string;
  borderClass: string;
  bgClass: string;
}

/**
 * Compute a composite risk score (0 to 100) for a project based on
 * financial disbursement anomalies, delay flags, grace-period-checked milestones,
 * and verified negative whistleblower reports.
 */
export function computeRiskScore(
  project: Pick<
    Project,
    | 'budgetPHP'
    | 'amountPaid'
    | 'progress'
    | 'flagStalled'
    | 'flagOverdue'
    | 'flagNeverStarted'
    | 'flagOverpaid'
    | 'startDate'
  > & {
    reviews?: Array<{ phoneVerified: boolean; rating: number }>;
  }
): number {
  let score = 0;

  // 1. Payment-to-progress gap (max 35 points)
  if (project.budgetPHP > 0) {
    const disbursementPct = project.amountPaid / project.budgetPHP;
    const progressPct = project.progress / 100;
    const gap = disbursementPct - progressPct;
    if (gap > 0) {
      score += Math.min(35, Math.round(gap * 50));
    }
  }

  // 2. Stalled (20 points)
  if (project.flagStalled) {
    score += 20;
  }

  // 3. Overdue (15 points)
  if (project.flagOverdue) {
    score += 15;
  }

  // 4. Never started (15 points — only if startDate + 90 days has passed to avoid day-1 false positives)
  if (project.flagNeverStarted) {
    const startDate = project.startDate ? new Date(project.startDate) : null;
    const gracePeriodPassed =
      startDate &&
      new Date().getTime() > startDate.getTime() + 90 * 24 * 60 * 60 * 1000;
    if (gracePeriodPassed) {
      score += 15;
    }
  }

  // 5. Overpaid (10 points)
  if (project.flagOverpaid) {
    score += 10;
  }

  // 6. Verified negative citizen corroboration (up to 5 points)
  if (project.reviews && project.reviews.length > 0) {
    const verifiedNegativeReviews = project.reviews.filter(
      (r) => r.phoneVerified && r.rating <= 2
    ).length;
    score += Math.min(5, verifiedNegativeReviews * 2);
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Get visual tier styling and label for a given risk score (0-100).
 */
export function getRiskScoreTier(score: number): RiskScoreTier {
  if (score >= 81) {
    return {
      label: 'Critical Risk',
      color: '#ef4444',
      badgeClass: 'text-rose-400 bg-rose-950/60 border-rose-800',
      borderClass: 'border-rose-700',
      bgClass: 'bg-rose-950/20',
    };
  }
  if (score >= 61) {
    return {
      label: 'High Risk',
      color: '#f97316',
      badgeClass: 'text-orange-400 bg-orange-950/60 border-orange-800',
      borderClass: 'border-orange-700',
      bgClass: 'bg-orange-950/20',
    };
  }
  if (score >= 31) {
    return {
      label: 'Moderate Risk',
      color: '#eab308',
      badgeClass: 'text-amber-400 bg-amber-950/60 border-amber-800',
      borderClass: 'border-amber-700',
      bgClass: 'bg-amber-950/20',
    };
  }
  return {
    label: 'Low Risk',
    color: '#10b981',
    badgeClass: 'text-emerald-400 bg-emerald-950/60 border-emerald-800',
    borderClass: 'border-emerald-700',
    bgClass: 'bg-emerald-950/20',
  };
}

