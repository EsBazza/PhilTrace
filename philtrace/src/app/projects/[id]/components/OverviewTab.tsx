'use client';

import Link from 'next/link';
import {
  BrainCircuit,
  TrendingUp,
  AlertTriangle,
  Building2,
  Newspaper,
  Satellite,
  ExternalLink,
  FileQuestion,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency, formatDate, cleanContractorName } from '@/lib/format';
import { ProjectDetailData } from '@/hooks/use-projects';

interface OverviewTabProps {
  project: ProjectDetailData;
  onNavigateTab: (tabId: string) => void;
}

export default function OverviewTab({ project, onNavigateTab }: OverviewTabProps) {
  const contractorName = cleanContractorName(project.contractorRaw || 'Unknown Contractor');
  const disbursementPct =
    project.budgetPHP > 0 ? Math.round((project.amountPaid / project.budgetPHP) * 100) : 0;
  const progressPct = Math.round(project.progress || 0);
  const gapPct = disbursementPct - progressPct;
  const isHighGap = gapPct >= 30;

  return (
    <div className="space-y-6">
      {/* 1. AI Forensic Briefing Card */}
      <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 via-slate-900 to-slate-950 p-5 shadow-lg">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <BrainCircuit className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">AI Forensic Executive Briefing</h3>
            <span className="text-[11px] text-cyan-400">Gemini 2.5 Flash Ground-Truth Analysis</span>
          </div>
        </div>

        <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 rounded-lg p-4 border border-slate-800/80">
          {project.aiSummary ? (
            <p>{project.aiSummary}</p>
          ) : (
            <p>
              This {project.category.toLowerCase()} contract involves an allocation of{' '}
              <strong className="text-white">{formatCurrency(project.budgetPHP)}</strong> situated in{' '}
              <strong className="text-white">{project.province?.name || 'the Philippines'}</strong>. Official
              DPWH records report <strong className="text-white">{progressPct}%</strong> physical completion with{' '}
              <strong className="text-white">{formatCurrency(project.amountPaid)}</strong> ({disbursementPct}%)
              disbursed.
              {isHighGap && (
                <span className="block mt-2 font-medium text-amber-300">
                  ⚠️ Alert: Financial payout outpaces reported physical completion by {gapPct}%, indicating an
                  accelerated billing anomaly that warrants citizen ground-truth inspection.
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* 2. Dual Comparison: Financial Disbursement vs Physical Progress */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-slate-200">Disbursement vs. Physical Progress Alignment</h4>
          </div>
          {isHighGap && (
            <span className="inline-flex items-center gap-1 rounded bg-rose-950/60 px-2 py-0.5 text-[11px] font-semibold text-rose-300 border border-rose-800">
              <AlertTriangle className="h-3 w-3" />
              {gapPct}% Gap Detected
            </span>
          )}
        </div>

        <div className="space-y-4">
          {/* Progress Bar 1: Financial Disbursement */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-400">Financial Payout (DPWH Check Disbursed)</span>
              <span className="font-semibold text-cyan-400">
                {formatCurrency(project.amountPaid)} ({disbursementPct}%)
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isHighGap ? 'bg-amber-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${Math.min(100, disbursementPct)}%` }}
              />
            </div>
          </div>

          {/* Progress Bar 2: Physical Works Progress */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-400">Reported Physical Progress</span>
              <span className="font-semibold text-emerald-400">{progressPct}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, progressPct)}%` }}
              />
            </div>
          </div>
        </div>

        {isHighGap && (
          <div className="mt-4 rounded-lg bg-amber-950/20 border border-amber-800/40 p-3 text-xs text-amber-300">
            <strong>Forensic Discrepancy Note:</strong> Funds released to the contractor substantially exceed the
            physical progress claimed on site. Inspect the satellite timeline and citizen whistleblower reviews to
            check for ghost or delayed works.
          </div>
        )}
      </div>

      {/* 3. Grid: Contractor at a Glance & Mini Satellite & FOI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contractor at a glance */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-cyan-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Primary Contractor
              </h4>
            </div>
            <p className="text-base font-bold text-white mb-1">{contractorName}</p>
            <p className="text-xs text-slate-400">
              Contract award for {project.category} situated in {project.province?.name}.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={() => onNavigateTab('connections')}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
            >
              View Joint Ventures & Ties →
            </button>
            <Link
              href={`/contractors?highlight=${encodeURIComponent(contractorName)}`}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition"
            >
              <span>Full Profile</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Mini Satellite Thumbnail */}
        <div
          onClick={() => onNavigateTab('satellite')}
          className="group cursor-pointer rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between transition hover:border-cyan-500/40 hover:bg-slate-900/80"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Satellite className="h-4 w-4 text-cyan-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Satellite Ground-Truth
                </h4>
              </div>
              <span className="rounded bg-cyan-950/60 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-800">
                ESRI Wayback
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-200">
              Inspect site changes over time (Start vs Present)
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Cross-reference official DPWH completion claims against time-series satellite photography.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-cyan-400 font-semibold group-hover:text-cyan-300">
            <span>Open Split-Screen Comparison</span>
            <span>→</span>
          </div>
        </div>
      </div>

      {/* 4. Action Banner: eFOI Portal Request */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <FileQuestion className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h5 className="text-xs font-bold text-slate-200">Notice Irregularities or Incomplete Civil Works?</h5>
            <p className="text-xs text-slate-400">
              Under Executive Order No. 2 (s. 2016), you have the right to request official DPWH inspection reports
              and notice to proceed documents via the Freedom of Information (eFOI) portal.
            </p>
          </div>
        </div>
        <a
          href="https://www.foi.gov.ph/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3.5 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-900/40 shrink-0"
        >
          <span>File eFOI Request</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
