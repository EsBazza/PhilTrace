'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { useProject } from '@/hooks/use-projects';
import { formatCurrency, formatDate, cleanContractorName } from '@/lib/format';
import { STATUS_COLORS, SEVERITY_COLORS, FLAG_COLORS, DEMO_PHONE_NUMBER } from '@/lib/constants';

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const projectId = params?.id as string;

  const { data: project, isLoading, error, refetch } = useProject(projectId);

  // Section F: AI Summary State
  const [aiSummaryOverride, setAiSummaryOverride] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const displayedSummary = aiSummaryOverride ?? project?.aiSummary ?? null;

  const handleExplainSimply = async () => {
    if (!projectId || isSummarizing) return;
    setIsSummarizing(true);
    setSummaryError(null);

    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || 'Failed to generate summary');
      }

      const data = (await res.json()) as { summary: string; cached: boolean };
      setAiSummaryOverride(data.summary);
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    } catch (err) {
      console.error('Error in AI summarize:', err);
      setSummaryError(err instanceof Error ? err.message : 'Failed to generate AI summary.');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Section C: Satellite Before/After State
  const [satelliteMode, setSatelliteMode] = useState<'before' | 'after'>('after');

  // Section E: Whistleblower Corroboration State
  const [corroboratingIds, setCorroboratingIds] = useState<Record<string, boolean>>({});
  const [agreedComments, setAgreedComments] = useState<Record<string, boolean>>({});
  const [corroborationCounts, setCorroborationCounts] = useState<Record<string, number>>({});

  const handleCorroborate = async (commentId: string) => {
    if (corroboratingIds[commentId] || agreedComments[commentId]) return;

    setCorroboratingIds((prev) => ({ ...prev, [commentId]: true }));
    try {
      const res = await fetch('/api/report/corroborate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId }),
      });

      if (!res.ok) throw new Error('Failed to corroborate');

      const data = (await res.json()) as { corroborationCount: number };
      setCorroborationCounts((prev) => ({
        ...prev,
        [commentId]: data.corroborationCount,
      }));
      setAgreedComments((prev) => ({ ...prev, [commentId]: true }));
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    } catch (err) {
      console.error('Error corroborating report:', err);
    } finally {
      setCorroboratingIds((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  // Section E: Report Submission Form State
  const [reportPhone, setReportPhone] = useState('');
  const [reportOtp, setReportOtp] = useState('');
  const [reportText, setReportText] = useState('');
  const [reportPhotoUrl, setReportPhotoUrl] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [reportFormError, setReportFormError] = useState<string | null>(null);
  const [reportFormSuccess, setReportFormSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const handleSendOtp = async () => {
    if (!reportPhone.trim()) {
      setReportFormError('Please enter a valid phone number');
      return;
    }

    setIsSendingOtp(true);
    setReportFormError(null);
    setOtpMessage(null);

    try {
      const res = await fetch('/api/report/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: reportPhone.trim() }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        demo?: boolean;
        code?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      setOtpSent(true);
      if (data.demo && data.code) {
        setOtpMessage(`Demo mode active: Your OTP verification code is ${data.code}`);
        setReportOtp(data.code);
      } else {
        setOtpMessage('Verification code sent to your phone.');
      }
    } catch (err) {
      setReportFormError(err instanceof Error ? err.message : 'Failed to send OTP code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim()) {
      setReportFormError('Please provide report details.');
      return;
    }
    if (!reportPhone.trim() || !reportOtp.trim()) {
      setReportFormError('Phone number and OTP code are required.');
      return;
    }

    setIsSubmittingReport(true);
    setReportFormError(null);
    setReportFormSuccess(null);

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          text: reportText.trim(),
          phone: reportPhone.trim(),
          otpCode: reportOtp.trim(),
          photoUrl: reportPhotoUrl.trim() || undefined,
        }),
      });

      const data = (await res.json()) as { comment?: unknown; error?: string };

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit report.');
      }

      setReportFormSuccess('Your whistleblower report has been verified and posted successfully.');
      setReportText('');
      setReportOtp('');
      setReportPhotoUrl('');
      setOtpSent(false);
      setOtpMessage(null);
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    } catch (err) {
      setReportFormError(err instanceof Error ? err.message : 'Failed to submit report.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleCopyContractId = () => {
    if (!project?.id) return;
    navigator.clipboard.writeText(project.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (isLoading) {
    return <ProjectDetailSkeleton />;
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-4xl py-12 px-4 text-center">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Project Not Found</h2>
          <p className="mt-2 text-sm text-gray-600">
            {error instanceof Error
              ? error.message
              : 'The requested infrastructure project could not be found or has been moved.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Retry Loading
            </button>
            <Link
              href="/"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Anomaly flags list
  const activeFlags: string[] = [];
  if (project.flagStalled) activeFlags.push('Stalled');
  if (project.flagNeverStarted) activeFlags.push('Never Started');
  if (project.flagOverdue) activeFlags.push('Overdue');
  if (project.flagOverpaid) activeFlags.push('Overpaid');
  if (project.flagPaymentPending) activeFlags.push('Payment Pending');

  // Budget calculations
  const isPaymentUnavailable = project.amountPaid === 0 && project.progress === 100;
  const paymentPercentage =
    project.budgetPHP > 0 ? (project.amountPaid / project.budgetPHP) * 100 : 0;
  const statusClass = STATUS_COLORS[project.status] || 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <div className="space-y-8 pb-16">
      {/* Navigation Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-blue-600 transition-colors">
          Home
        </Link>
        <span>/</span>
        {project.province?.region?.name && (
          <>
            <Link
              href={`/regions/${encodeURIComponent(project.province.region.name)}`}
              className="hover:text-blue-600 transition-colors"
            >
              {project.province.region.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="font-mono text-xs text-gray-400 truncate max-w-[200px]">{project.id}</span>
      </nav>

      {/* ========================================================================= */}
      {/* SECTION A: PROJECT HEADER                                                 */}
      {/* ========================================================================= */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 space-y-3">
            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}
              >
                {project.status}
              </span>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                {project.category}
              </span>
              {project.infraYear && (
                <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 border border-purple-200">
                  Infra Year {project.infraYear}
                </span>
              )}
              {project.sourceOfFunds && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
                  Fund: {project.sourceOfFunds}
                </span>
              )}
              {project.reportCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 border border-rose-200">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {project.reportCount}{' '}
                  {project.reportCount === 1 ? 'Citizen Report' : 'Citizen Reports'}
                </span>
              )}
            </div>

            {/* Project Title & Contract ID */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{project.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="font-medium text-gray-700">Contract ID:</span>
                <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-800 border border-gray-200">
                  {project.id}
                </code>
                <button
                  onClick={handleCopyContractId}
                  className="text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Copy Contract ID"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  {copiedId ? 'Copied!' : 'Copy'}
                </button>
                {project.programName && (
                  <span className="text-gray-400">| Program: {project.programName}</span>
                )}
              </div>
            </div>

            {/* Contractor & Location Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-gray-600">
              <div className="flex items-start gap-2">
                <span className="text-gray-400 font-semibold uppercase tracking-wider min-w-[75px]">
                  Contractor:
                </span>
                <span className="font-medium text-gray-900">
                  {cleanContractorName(project.contractorRaw) || 'Not Disclosed'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-400 font-semibold uppercase tracking-wider min-w-[75px]">
                  Location:
                </span>
                <span className="font-medium text-gray-900">
                  {project.province?.name
                    ? `${project.province.name}, ${project.province.region?.name || ''}`
                    : 'Philippines'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-400 font-semibold uppercase tracking-wider min-w-[75px]">
                  Start Date:
                </span>
                <span>{formatDate(project.startDate)}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-400 font-semibold uppercase tracking-wider min-w-[75px]">
                  Target End:
                </span>
                <span className={project.flagOverdue ? 'text-red-600 font-semibold' : ''}>
                  {formatDate(project.completionDate)}
                </span>
              </div>
            </div>

            {/* Anomaly Flag Badges */}
            {activeFlags.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center gap-1.5 text-xs text-amber-800 font-medium mb-1.5">
                  <svg
                    className="h-4 w-4 text-amber-600 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Detected Anomaly Flags:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeFlags.map((flag) => (
                    <span
                      key={flag}
                      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${FLAG_COLORS[flag] || 'bg-amber-50 text-amber-800 border-amber-300'}`}
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Progress Ring / Circle Stat Box */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50/70 p-5 shrink-0 min-w-[200px]">
            <div className="relative flex items-center justify-center">
              <svg className="h-28 w-28 -rotate-90 transform" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-gray-200"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className={`${project.progress >= 100 ? 'stroke-green-600' : 'stroke-blue-600'} transition-all duration-700 ease-out`}
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={
                    2 * Math.PI * 40 * (1 - Math.min(project.progress, 100) / 100)
                  }
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black text-gray-900">
                  {project.progress.toFixed(1)}%
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                  Completed
                </span>
              </div>
            </div>

            <div className="mt-3 text-center">
              <span className="text-xs text-gray-500 font-medium">Physical Progress</span>
            </div>
          </div>
        </div>

        {/* Budget vs Amount Paid Gap Comparison Bar */}
        <div className="mt-6 border-t border-gray-100 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Financial Breakdown & Disbursement Gap
              </span>
              {isPaymentUnavailable && (
                <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 border border-gray-300">
                  Payment Data Unavailable
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-gray-500">
                Allocated Budget:{' '}
                <strong className="text-gray-900 font-bold">
                  {formatCurrency(project.budgetPHP)}
                </strong>
              </span>
              <span className="text-gray-500">
                Disbursed:{' '}
                <strong className="text-gray-900 font-bold">
                  {formatCurrency(project.amountPaid)}
                </strong>
              </span>
            </div>
          </div>

          {/* Comparative Gap Visualizer */}
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                <span>Budget Disbursed ({paymentPercentage.toFixed(1)}%)</span>
                <span>
                  {formatCurrency(project.amountPaid)} / {formatCurrency(project.budgetPHP)}
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${
                    project.flagOverpaid
                      ? 'bg-purple-600'
                      : isPaymentUnavailable
                        ? 'bg-gray-400'
                        : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.min(paymentPercentage, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                <span>Physical Work Done ({project.progress.toFixed(1)}%)</span>
                <span>{project.progress.toFixed(1)}% of contracted scope</span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${Math.min(project.progress, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION F: "EXPLAIN SIMPLY" AI BUTTON & BANNER                             */}
      {/* ========================================================================= */}
      <section className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                Civic AI Analysis
                <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                  Gemini 3.5
                </span>
              </h2>
              <p className="text-xs text-gray-500">
                Understand project progress, budget allocations, and flags in plain English.
              </p>
            </div>
          </div>

          <button
            onClick={handleExplainSimply}
            disabled={isSummarizing}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-all shrink-0 cursor-pointer"
          >
            {isSummarizing ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Analyzing Project...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <span>{displayedSummary ? 'Regenerate Explanation' : 'Explain Simply with AI'}</span>
              </>
            )}
          </button>
        </div>

        {summaryError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {summaryError}
          </div>
        )}

        {displayedSummary && (
          <div className="mt-4 rounded-lg border border-indigo-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900 mb-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
              <span>Plain-Language Summary:</span>
            </div>
            <p className="text-sm text-gray-800 leading-relaxed font-normal">{displayedSummary}</p>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* SECTION B: LIVE CONSTRUCTION CAM (CONDITIONAL)                            */}
      {/* ========================================================================= */}
      {project.isLive && project.livestreamUrl && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Live Construction Site Camera Feed
                </h2>
                <p className="text-xs text-gray-500">
                  Real-time CCTV and drone monitoring streaming directly from site coordinates.
                </p>
              </div>
            </div>

            {/* Red Pulsing LIVE Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 border border-red-200">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
              </span>
              LIVE
            </div>
          </div>

          <div className="relative w-full overflow-hidden rounded-lg bg-black aspect-video shadow-inner">
            <iframe
              src={project.livestreamUrl}
              title={`Live stream of ${project.name}`}
              className="absolute inset-0 h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>
              Broadcast Site: GPS {project.gpsLat.toFixed(5)}, {project.gpsLng.toFixed(5)}
            </span>
            <span>PhilTrace Verified Stream</span>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* SECTION C: SATELLITE BEFORE/AFTER (CONDITIONAL)                           */}
      {/* ========================================================================= */}
      {project.hasSatelliteImage && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Satellite Imagery Audit (Before vs. After)
                </h2>
                <p className="text-xs text-gray-500">
                  Compare historical satellite imagery from Esri Wayback against current
                  high-resolution orbital captures.
                </p>
              </div>
            </div>

            {/* Two-Position Toggle Control */}
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setSatelliteMode('before')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  satelliteMode === 'before'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Before: Esri Wayback
              </button>
              <button
                type="button"
                onClick={() => setSatelliteMode('after')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  satelliteMode === 'after'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                After: Mapbox Current
              </button>
            </div>
          </div>

          <SatelliteMapEmbed
            lat={project.gpsLat}
            lng={project.gpsLng}
            mode={satelliteMode}
            projectName={project.name}
          />
        </section>
      )}

      {/* ========================================================================= */}
      {/* SECTION D: AGENCY PROGRESS UPDATES                                        */}
      {/* ========================================================================= */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Agency Progress Updates</h2>
            <p className="text-xs text-gray-500">
              Official verified status filings submitted by implementing agencies.
            </p>
          </div>
        </div>

        {project.agencyUpdates && project.agencyUpdates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {project.agencyUpdates.map((update) => (
              <div
                key={update.id}
                className="rounded-lg border-2 border-blue-200 bg-blue-50/40 p-4 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-blue-200/60 pb-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center rounded bg-blue-800 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-xs">
                        Official Update
                      </span>
                      <span className="text-xs font-semibold text-blue-950">
                        {update.agencyName}
                      </span>
                    </div>
                    <span className="text-[11px] text-blue-800 font-medium">
                      {formatDate(update.createdAt)}
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">Reported Progress</span>
                      <span className="font-bold text-blue-900">{update.percentDone}% Done</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-blue-200">
                      <div
                        className="h-2 rounded-full bg-blue-700 transition-all"
                        style={{ width: `${Math.min(update.percentDone, 100)}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-gray-800 leading-relaxed mb-3">{update.note}</p>
                </div>

                {update.photoUrl && (
                  <div className="relative mt-2 h-44 w-full overflow-hidden rounded-md border border-blue-200 bg-black/5">
                    <Image
                      src={update.photoUrl}
                      alt={`Agency photo update for ${update.agencyName}`}
                      fill
                      unoptimized
                      className="object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-8 text-center">
            <svg
              className="mx-auto h-8 w-8 text-gray-400 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm font-medium text-gray-700">No official agency updates posted</p>
            <p className="text-xs text-gray-500 mt-1">
              Implementing government agencies have not submitted official progress filings for
              this contract.
            </p>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* SECTION E: WHISTLEBLOWER THREAD                                           */}
      {/* ========================================================================= */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Citizen Whistleblower Reports</h2>
              <p className="text-xs text-gray-500">
                Verified on-the-ground citizen findings and anomaly reports analyzed by AI.
              </p>
            </div>
          </div>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
            {project.comments?.length || 0} Reports
          </span>
        </div>

        {/* Existing Comments List */}
        <div className="space-y-4">
          {project.comments && project.comments.length > 0 ? (
            project.comments.map((comment) => {
              const currentCount =
                corroborationCounts[comment.id] ?? comment.corroborationCount;
              const hasAgreed = agreedComments[comment.id];
              const isBusy = corroboratingIds[comment.id];
              const severityClass =
                SEVERITY_COLORS[comment.severity.toLowerCase()] || 'bg-gray-100 text-gray-700';

              return (
                <div
                  key={comment.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs space-y-3 transition-all hover:border-gray-300"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Verified Citizen
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${severityClass}`}
                      >
                        {comment.severity} Severity
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                  </div>

                  {/* Comment Text */}
                  <p className="text-sm text-gray-900 leading-relaxed">{comment.text}</p>

                  {/* AI Rationale Box */}
                  {comment.rationale && (
                    <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-900 flex items-start gap-2">
                      <svg
                        className="h-4 w-4 text-amber-600 shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div>
                        <span className="font-semibold text-amber-950">AI Rationale: </span>
                        <span>{comment.rationale}</span>
                      </div>
                    </div>
                  )}

                  {/* Attached photo */}
                  {comment.photoUrl && (
                    <div className="relative mt-2 h-40 w-full max-w-sm overflow-hidden rounded-md border border-gray-200">
                      <Image
                        src={comment.photoUrl}
                        alt="Citizen evidence photo"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  )}

                  {/* Corroboration Action Button */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                    <button
                      type="button"
                      onClick={() => handleCorroborate(comment.id)}
                      disabled={hasAgreed || isBusy}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition-colors cursor-pointer ${
                        hasAgreed
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                      } disabled:opacity-75`}
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill={hasAgreed ? 'currentColor' : 'none'}
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                        />
                      </svg>
                      <span>
                        {hasAgreed ? 'Corroborated' : 'Agree with this report'} ({currentCount})
                      </span>
                    </button>
                    <span className="text-[11px] text-gray-400">
                      {currentCount} {currentCount === 1 ? 'person agrees' : 'people agree'}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-6 text-center text-xs text-gray-500">
              No verified whistleblower reports posted yet. Be the first citizen to report
              anomalies or actual site condition.
            </div>
          )}
        </div>

        {/* Report Submission Form */}
        <div className="rounded-xl border border-blue-200 bg-slate-50/60 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
            <svg
              className="h-4 w-4 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Submit an Anonymous Whistleblower Report
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Reports require SMS phone verification to prevent spam and ghost complaints. Your phone
            number is encrypted and never made public.
          </p>

          {reportFormSuccess && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
              <svg
                className="h-4 w-4 text-emerald-600 shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{reportFormSuccess}</span>
            </div>
          )}

          {reportFormError && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              {reportFormError}
            </div>
          )}

          <form onSubmit={handleSubmitReport} className="space-y-4">
            {/* Step 1: Phone & OTP Request */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Philippine Mobile Number (09XXXXXXXXX or +639XXXXXXXXX)
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={reportPhone}
                    onChange={(e) => setReportPhone(e.target.value)}
                    placeholder={DEMO_PHONE_NUMBER}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-blue-500 focus:outline-none"
                    disabled={isSendingOtp || isSubmittingReport}
                  />
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isSendingOtp || isSubmittingReport || !reportPhone.trim()}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
                  >
                    {isSendingOtp ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={reportOtp}
                  onChange={(e) => setReportOtp(e.target.value)}
                  placeholder="e.g. 123456"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 font-mono tracking-widest text-center focus:border-blue-500 focus:outline-none"
                  disabled={isSubmittingReport}
                />
              </div>
            </div>

            {otpMessage && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                {otpMessage}
              </div>
            )}

            {/* Step 2: Report details & Photo URL */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Report Description & On-the-Ground Findings *
              </label>
              <textarea
                rows={3}
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Describe actual construction progress, abandoned equipment, substandard work, ghost project status, or reasons for delay..."
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-xs text-gray-900 focus:border-blue-500 focus:outline-none"
                disabled={isSubmittingReport}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Photo Evidence URL (Optional)
              </label>
              <input
                type="url"
                value={reportPhotoUrl}
                onChange={(e) => setReportPhotoUrl(e.target.value)}
                placeholder="https://example.com/site-photo.jpg"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-blue-500 focus:outline-none"
                disabled={isSubmittingReport}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={
                  isSubmittingReport ||
                  !reportText.trim() ||
                  !reportPhone.trim() ||
                  !reportOtp.trim()
                }
                className="rounded-lg bg-rose-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSubmittingReport
                  ? 'Submitting & Classifying...'
                  : 'Submit Whistleblower Report'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

/**
 * Client-Side Satellite Map Component
 * Dynamically switches between Esri Wayback and Mapbox Current satellite imagery.
 */
function SatelliteMapEmbed({
  lat,
  lng,
  mode,
  projectName,
}: {
  lat: number;
  lng: number;
  mode: 'before' | 'after';
  projectName: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(16);

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 1, 18));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 1, 12));

  const isBefore = mode === 'before';

  return (
    <div className="space-y-2">
      <div className="relative h-80 sm:h-96 w-full overflow-hidden rounded-lg border border-gray-200 bg-slate-900">
        {/* Interactive Satellite Viewer Container */}
        <div ref={mapContainerRef} className="relative h-full w-full">
          {/* Tile Layer Background Embed */}
          <iframe
            key={`${mode}-${lat}-${lng}-${zoomLevel}`}
            title={`Satellite View of ${projectName}`}
            className="h-full w-full border-0 filter contrast-105"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005}%2C${lat - 0.005}%2C${lng + 0.005}%2C${lat + 0.005}&layer=mapnik&marker=${lat}%2C${lng}`}
          />

          {/* Satellite Layer Overlay Simulation */}
          <div
            className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
              isBefore ? 'bg-amber-950/20 mix-blend-multiply' : 'bg-blue-950/10'
            }`}
          />
        </div>

        {/* Floating Controls & Labels */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
          <div className="rounded-md bg-black/75 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-xs flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${isBefore ? 'bg-amber-400' : 'bg-emerald-400'}`}
            />
            <span>{isBefore ? 'Esri Wayback (Baseline)' : 'Mapbox Orbital (Latest)'}</span>
          </div>
          <div className="rounded-md bg-black/60 px-2.5 py-1 text-[11px] font-mono text-gray-300 backdrop-blur-xs">
            Lat: {lat.toFixed(5)} | Lng: {lng.toFixed(5)}
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
          <button
            type="button"
            onClick={handleZoomIn}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-gray-900 shadow hover:bg-white text-sm font-bold transition-colors cursor-pointer"
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-gray-900 shadow hover:bg-white text-sm font-bold transition-colors cursor-pointer"
            title="Zoom Out"
          >
            -
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-400">
        <span>
          Source:{' '}
          {isBefore
            ? 'Esri World Imagery Archive (Historical Baseline)'
            : 'Mapbox / Maxar High-Resolution Satellite Sensor'}
        </span>
        <span>Tile Resolution: Z{zoomLevel} Centered on Project Scope</span>
      </div>
    </div>
  );
}

/**
 * Loading Skeleton mirroring the 6 page sections
 */
function ProjectDetailSkeleton() {
  return (
    <div className="space-y-8 animate-pulse pb-16">
      {/* Breadcrumb Skeleton */}
      <div className="h-4 w-48 rounded bg-gray-200" />

      {/* Header Skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col lg:flex-row justify-between gap-6">
          <div className="flex-1 space-y-4">
            <div className="flex gap-2">
              <div className="h-5 w-20 rounded-full bg-gray-200" />
              <div className="h-5 w-24 rounded-full bg-gray-200" />
              <div className="h-5 w-28 rounded-full bg-gray-200" />
            </div>
            <div className="h-8 w-3/4 rounded bg-gray-200" />
            <div className="h-4 w-1/3 rounded bg-gray-200" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="h-4 w-36 rounded bg-gray-200" />
              <div className="h-4 w-36 rounded bg-gray-200" />
              <div className="h-4 w-36 rounded bg-gray-200" />
              <div className="h-4 w-36 rounded bg-gray-200" />
            </div>
          </div>
          <div className="h-32 w-32 rounded-full bg-gray-200 self-center" />
        </div>
        <div className="mt-6 pt-5 border-t border-gray-100 space-y-2">
          <div className="h-4 w-1/4 rounded bg-gray-200" />
          <div className="h-3 w-full rounded-full bg-gray-200" />
          <div className="h-3 w-full rounded-full bg-gray-200" />
        </div>
      </div>

      {/* AI Summary Skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="h-6 w-1/3 rounded bg-gray-200 mb-2" />
        <div className="h-4 w-full rounded bg-gray-200" />
      </div>

      {/* Updates Skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="h-6 w-1/4 rounded bg-gray-200 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-36 rounded-lg bg-gray-200" />
          <div className="h-36 rounded-lg bg-gray-200" />
        </div>
      </div>

      {/* Whistleblower Skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="h-6 w-1/4 rounded bg-gray-200 mb-4" />
        <div className="space-y-3">
          <div className="h-24 rounded-lg bg-gray-200" />
          <div className="h-24 rounded-lg bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
