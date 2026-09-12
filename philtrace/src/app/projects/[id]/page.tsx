'use client';

import { useState, use, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Building2,
  Calendar,
  Share2,
  ExternalLink,
  FileQuestion,
  FileText,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Layers,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useProject } from '@/hooks/use-projects';
import { formatCurrency, formatDate, cleanContractorName } from '@/lib/format';
import { getRiskScoreTier } from '@/lib/anomaly-flags';
import OverviewTab from './components/OverviewTab';
import SatelliteTab from './components/SatelliteTab';
import NewsTab from './components/NewsTab';
import FinancialsTab from './components/FinancialsTab';
import CommunityTab from './components/CommunityTab';
import ConnectionsTab from './components/ConnectionsTab';

interface PageProps {
  params: Promise<{ id: string }>;
}

type TabType = 'overview' | 'satellite' | 'news' | 'financials' | 'community' | 'connections';

export default function ProjectDossierPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: project, isLoading, error, refetch } = useProject(id);

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [copied, setCopied] = useState<boolean>(false);
  const [isVerifyingPdf, setIsVerifyingPdf] = useState<boolean>(false);

  // Sync with URL hash if provided
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '') as TabType;
      const validTabs: TabType[] = [
        'overview',
        'satellite',
        'news',
        'financials',
        'community',
        'connections',
      ];
      if (validTabs.includes(hash)) {
        setActiveTab(hash);
      }
    }
  }, []);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${tab}`);
    }
  };

  const handleShare = async () => {
    if (typeof window !== 'undefined') {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleViewFullContract = async () => {
    const rawPdf = project?.contractDocument?.sourcePdfUrl;
    if (!rawPdf) {
      handleTabChange('financials');
      return;
    }

    setIsVerifyingPdf(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    let targetUrl = rawPdf;

    try {
      const headRes = await fetch(rawPdf, { method: 'HEAD', signal: controller.signal });
      if (!headRes.ok) {
        throw new Error('HEAD check failed');
      }
    } catch {
      // Fallback to Wayback Machine CDX API
      try {
        const waybackRes = await fetch(
          `https://archive.org/wayback/available?url=${encodeURIComponent(rawPdf)}`,
          { signal: controller.signal }
        );
        if (waybackRes.ok) {
          const wbData = await waybackRes.json();
          const closest = wbData.archived_snapshots?.closest;
          if (closest && closest.available && closest.url) {
            targetUrl = closest.url;
          }
        }
      } catch {
        // Use raw URL as ultimate fallback
      }
    } finally {
      clearTimeout(timeoutId);
      setIsVerifyingPdf(false);
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          <p className="text-sm font-semibold tracking-wide text-slate-300">
            Loading public infrastructure dossier...
          </p>
          <span className="text-xs text-slate-500 font-mono">Contract ID: {id}</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-slate-200">
        <ShieldAlert className="h-12 w-12 text-rose-400 mb-3" />
        <h2 className="text-lg font-bold text-white">Project Record Not Found</h2>
        <p className="text-xs text-slate-400 max-w-sm mt-1 mb-6">
          Could not retrieve contract details for ID <strong className="font-mono">{id}</strong>.
          The record may not exist in the DPWH database or has not yet been ingested.
        </p>
        <Link
          href="/map"
          className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition"
        >
          Return to National Map
        </Link>
      </div>
    );
  }

  const contractorName = cleanContractorName(project.contractorRaw || 'Unknown Contractor');
  const riskTier = getRiskScoreTier(project.riskScore || 0);

  const tabs: Array<{ id: TabType; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'satellite', label: 'Satellite Evidence' },
    { id: 'news', label: 'News & Media' },
    { id: 'financials', label: 'Financials & BOQ' },
    { id: 'community', label: 'Community Reports', count: project.reviews?.length || 0 },
    { id: 'connections', label: 'Connections' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500/30 pb-20">
      {/* ─── HERO SECTION ────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Breadcrumb navigation */}
          <nav className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            <Link
              href={`/map?project=${encodeURIComponent(project.id)}`}
              className="flex items-center gap-1 font-semibold text-cyan-400 hover:text-cyan-300 transition"
            >
              <MapPin className="h-3 w-3" />
              <span>National Map</span>
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span>{project.province?.region?.name || 'Region'}</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span>{project.province?.name || 'Province'}</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="font-mono text-slate-200">{project.id}</span>
          </nav>

          {/* Anomaly Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {project.flagOverpaid && (
              <span className="rounded-full border border-rose-800 bg-rose-950/80 px-2.5 py-0.5 text-xs font-bold text-rose-300">
                🚨 Overpaid (Ghost Risk)
              </span>
            )}
            {project.flagStalled && (
              <span className="rounded-full border border-amber-800 bg-amber-950/80 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                ⚠️ Stalled Works
              </span>
            )}
            {project.flagOverdue && (
              <span className="rounded-full border border-amber-700 bg-amber-900/60 px-2.5 py-0.5 text-xs font-semibold text-amber-200">
                Overdue Milestone
              </span>
            )}
            {project.flagNeverStarted && (
              <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                Never Started
              </span>
            )}
            {project.flagPaymentPending && (
              <span className="rounded-full border border-blue-800 bg-blue-950/80 px-2.5 py-0.5 text-xs font-medium text-blue-300">
                Payment Pending
              </span>
            )}
            <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-0.5 text-xs font-medium text-slate-400">
              {project.category}
            </span>
          </div>

          {/* Project Title and Metadata */}
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight">
              {project.name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2.5">
              <div className="flex items-center gap-1.5 font-medium text-slate-300">
                <Building2 className="h-4 w-4 text-cyan-400" />
                <span>{contractorName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-slate-500" />
                <span>
                  {formatDate(project.startDate)} →{' '}
                  {project.completionDate ? formatDate(project.completionDate) : 'Ongoing'}
                </span>
              </div>
              <span className="font-mono text-slate-500">ID: {project.id}</span>
            </div>
          </div>

          {/* 4 Stat Cards in a Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            {/* Card 1: Budget */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Contract Budget
              </span>
              <p className="text-lg sm:text-xl font-black text-white mt-1">
                {formatCurrency(project.budgetPHP)}
              </p>
              <span className="text-[10px] text-slate-500">Total Approved Allocation</span>
            </div>

            {/* Card 2: Disbursed */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Amount Disbursed
              </span>
              <p className="text-lg sm:text-xl font-black text-cyan-400 mt-1">
                {formatCurrency(project.amountPaid)}
              </p>
              <span className="text-[10px] text-slate-500">
                {project.budgetPHP > 0
                  ? `${Math.round((project.amountPaid / project.budgetPHP) * 100)}% of total budget`
                  : '—'}
              </span>
            </div>

            {/* Card 3: Physical Progress */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Physical Progress
              </span>
              <p className="text-lg sm:text-xl font-black text-emerald-400 mt-1">
                {Math.round(project.progress)}%
              </p>
              <span className="text-[10px] text-slate-500">Official DPWH Claimed</span>
            </div>

            {/* Card 4: Composite Risk Score */}
            <div className={`rounded-xl border ${riskTier.borderClass} ${riskTier.bgClass} p-4 shadow`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                  Forensic Risk Score
                </span>
                <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${riskTier.badgeClass}`}>
                  {riskTier.label}
                </span>
              </div>
              <p className="text-lg sm:text-xl font-black text-white mt-1">
                {project.riskScore}
                <span className="text-xs font-normal text-slate-400">/100</span>
              </p>
              <span className="text-[10px] text-slate-400">Composite Multi-Factor</span>
            </div>
          </div>

          {/* Action Buttons Bar */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              onClick={handleViewFullContract}
              disabled={isVerifyingPdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-cyan-500 transition disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              <span>{isVerifyingPdf ? 'Validating Link...' : 'View Full Contract'}</span>
              <ExternalLink className="h-3 w-3" />
            </button>

            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              <Share2 className="h-4 w-4" />
              <span>{copied ? 'Link Copied!' : 'Share Dossier'}</span>
            </button>

            <a
              href="https://www.foi.gov.ph/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              <FileQuestion className="h-4 w-4 text-amber-400" />
              <span>File FOI Request</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* ─── TAB NAVIGATION STRIP ─────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex space-x-1 overflow-x-auto py-2.5 scrollbar-none">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── TAB CONTENT PANELS (DOM-Preserved Zero Layout Shift) ─── */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className={activeTab === 'overview' ? 'block' : 'hidden'}>
          <OverviewTab project={project} onNavigateTab={(tab) => handleTabChange(tab as TabType)} />
        </div>

        <div className={activeTab === 'satellite' ? 'block' : 'hidden'}>
          <SatelliteTab project={project} />
        </div>

        <div className={activeTab === 'news' ? 'block' : 'hidden'}>
          <NewsTab project={project} />
        </div>

        <div className={activeTab === 'financials' ? 'block' : 'hidden'}>
          <FinancialsTab project={project} />
        </div>

        <div className={activeTab === 'community' ? 'block' : 'hidden'}>
          <CommunityTab project={project} onReviewSubmitted={() => refetch()} />
        </div>

        <div className={activeTab === 'connections' ? 'block' : 'hidden'}>
          <ConnectionsTab project={project} />
        </div>
      </main>
    </div>
  );
}
