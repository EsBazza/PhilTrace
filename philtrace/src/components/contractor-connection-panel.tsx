'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  ExternalLink,
  ShieldAlert,
  Building2,
  Landmark,
  FileSignature,
  Share2,
  Info,
} from 'lucide-react';
import { cleanContractorName, parseContractors } from '@/lib/format';

export interface ContractorConnectionItem {
  id: string;
  connectedName: string;
  connectionType: 'NEWS_MENTION' | 'SHARED_ADDRESS' | 'CONGRESS_RECORD' | string;
  sourceLabel: string;
  sourceUrl: string;
  confidence: string;
  displayText?: string;
}

interface ContractorConnectionPanelProps {
  contractorRaw: string;
  engineerSignature?: {
    engineerName: string;
    engineerTitle: string;
    district?: string | null;
  } | null;
}

export default function ContractorConnectionPanel({
  contractorRaw,
  engineerSignature,
}: ContractorConnectionPanelProps) {
  const primaryName = cleanContractorName(contractorRaw || 'Unknown Contractor');
  const jvPartners = parseContractors(contractorRaw).filter(
    (n) => n.toLowerCase() !== primaryName.toLowerCase()
  );

  const [connections, setConnections] = useState<ContractorConnectionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [disclaimer, setDisclaimer] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadConnections() {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/contractors/${encodeURIComponent(primaryName)}/connections`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setConnections(data.connections || []);
            setDisclaimer(data.disclaimer || '');
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error fetching connections:', err);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (primaryName && primaryName !== 'Unknown Contractor') {
      loadConnections();
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [primaryName]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Disclaimer banner */}
      <div className="flex items-start gap-2.5 rounded-lg border border-slate-800 bg-slate-900/60 p-3.5 text-xs text-slate-400">
        <Info className="h-4 w-4 shrink-0 text-cyan-400" />
        <p>
          {disclaimer ||
            'PhilTrace highlights journalistic, congressional, and public registry citations for civic transparency. These citations reflect public records and do not constitute criminal indictments.'}
        </p>
      </div>

      {/* Primary Contractor Card */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 p-5 shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 font-bold text-cyan-400 border border-cyan-500/20 text-base">
              {getInitials(primaryName)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  Primary Contractor
                </span>
              </div>
              <h3 className="text-lg font-bold text-white">{primaryName}</h3>
              {contractorRaw.includes('(JV)') || contractorRaw.includes('/') ? (
                <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20 mt-1">
                  Joint Venture Award
                </span>
              ) : null}
            </div>
          </div>

          <Link
            href={`/contractors?highlight=${encodeURIComponent(primaryName)}`}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-900/50 hover:border-cyan-400"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>View Full Network Graph</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Hierarchical Connections Tree */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Known Relationships & Signatories
          </h4>
          <span className="text-xs text-slate-500">
            {jvPartners.length + connections.length + (engineerSignature ? 1 : 0)} connected
          </span>
        </div>

        {/* 1. Joint Venture Partners */}
        {jvPartners.map((partner, idx) => (
          <div
            key={`jv-${idx}`}
            className="group relative ml-4 flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-950/10 p-3.5 pl-4 transition hover:bg-amber-950/20"
          >
            <div className="absolute -left-4 top-1/2 h-px w-4 bg-amber-500/40" />
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 font-semibold text-xs border border-amber-500/30">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/30">
                    Joint Venture Partner
                  </span>
                  <span className="text-xs text-slate-400">Co-Bidder on Record</span>
                </div>
                <p className="text-sm font-semibold text-slate-200 mt-0.5">{partner}</p>
              </div>
            </div>

            <Link
              href={`/contractors?highlight=${encodeURIComponent(partner)}`}
              className="rounded p-1.5 text-slate-400 hover:text-amber-300 transition"
              title="Inspect contractor"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        ))}

        {/* 2. District Engineer Signatory */}
        {engineerSignature && (
          <div className="group relative ml-4 flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-950/10 p-3.5 pl-4 transition hover:bg-blue-950/20">
            <div className="absolute -left-4 top-1/2 h-px w-4 bg-blue-500/40" />
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300 font-semibold text-xs border border-blue-500/30">
                <FileSignature className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400 border border-blue-500/30">
                    District Engineer
                  </span>
                  {engineerSignature.district && (
                    <span className="text-xs text-slate-400">
                      {engineerSignature.district}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-200 mt-0.5">
                  {engineerSignature.engineerName}
                </p>
                <p className="text-xs text-slate-400">
                  {engineerSignature.engineerTitle}
                </p>
              </div>
            </div>

            <Link
              href="/engineers"
              className="rounded p-1.5 text-slate-400 hover:text-blue-300 transition"
              title="View District Engineer network"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* 3. Database Connections (Politicians, Shell Cos, News Mentions) */}
        {connections.map((conn) => {
          let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
          let badgeLabel = 'Mention';
          let IconComponent = Landmark;

          if (conn.connectionType === 'CONGRESS_RECORD') {
            badgeColor = 'bg-rose-950/40 text-rose-400 border-rose-800/60';
            badgeLabel = 'Politician · Congress Record';
            IconComponent = Landmark;
          } else if (conn.connectionType === 'SHARED_ADDRESS') {
            badgeColor = 'bg-purple-950/40 text-purple-400 border-purple-800/60';
            badgeLabel = 'Shell Co. · Shared Address';
            IconComponent = Building2;
          } else if (conn.connectionType === 'NEWS_MENTION') {
            badgeColor = 'bg-slate-800/80 text-slate-300 border-slate-700';
            badgeLabel = 'Investigative News Mention';
            IconComponent = ShieldAlert;
          }

          return (
            <div
              key={conn.id}
              className="group relative ml-4 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 p-3.5 pl-4 transition hover:bg-slate-900/70"
            >
              <div className="absolute -left-4 top-1/2 h-px w-4 bg-slate-700" />
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700">
                  <IconComponent className="h-4 w-4 text-slate-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${badgeColor}`}
                    >
                      {badgeLabel}
                    </span>
                    <span className="text-xs text-slate-500">
                      via {conn.sourceLabel}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5">
                    {conn.connectedName}
                  </p>
                </div>
              </div>

              {conn.sourceUrl && (
                <a
                  href={conn.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition"
                  title={`Source: ${conn.sourceLabel}`}
                >
                  <span className="hidden sm:inline">Source</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          );
        })}

        {/* Empty state if no connections found */}
        {!isLoading &&
          jvPartners.length === 0 &&
          !engineerSignature &&
          connections.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center">
              <Building2 className="mx-auto h-8 w-8 text-slate-600 mb-2" />
              <p className="text-sm text-slate-400 font-medium">
                No active joint ventures, political ties, or flagged signatories registered.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Contract is held by a single contractor entity with clean signatory records.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
