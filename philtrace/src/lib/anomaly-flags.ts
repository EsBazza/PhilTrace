import type { Project, AgencyUpdate } from '@prisma/client';

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
  latestAgencyUpdate: Pick<AgencyUpdate, 'createdAt'> | null,
  commentCount: number
): AnomalyFlags {
  const now = new Date();

  // flagStalled: On-Going, no agency update in 180+ days, progress unchanged
  const daysSinceUpdate = latestAgencyUpdate
    ? (now.getTime() - new Date(latestAgencyUpdate.createdAt).getTime()) / (1000 * 60 * 60 * 24)
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
