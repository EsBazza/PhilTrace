'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/format';
import PhilippinesMap from '@/components/philippines-map';

interface RegionStats {
  name: string;
  totalProjects: number;
  flaggedProjects: number;
  totalBudget: number;
  anomalyDensity: number;
}

interface HomeData {
  regions: RegionStats[];
  totalContracts: number;
  totalBudget: number;
  lastSync: string;
}

export default function HomePage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'map' | 'cards'>('map');

  const { data, isLoading, error } = useQuery<HomeData>({
    queryKey: ['home-stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const getColor = useCallback((density: number): string => {
    if (density >= 0.5) return '#dc2626'; // red
    if (density >= 0.3) return '#ea580c'; // orange
    if (density >= 0.15) return '#eab308'; // yellow
    if (density >= 0.05) return '#84cc16'; // lime
    return '#22c55e'; // green
  }, []);

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-semibold">Failed to load national data. Please refresh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top National Summary Banner */}
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/30 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE DPWH INFRASTRUCTURE AUDIT REGISTRY
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight">
              PhilTrace National Transparency Portal
            </h1>
            <p className="mt-1 text-xs md:text-sm text-blue-200 max-w-xl">
              Cross-referencing government expenditure, citizen whistleblower reports, and satellite Wayback imagery across 248,000+ public contracts.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-white/10 p-4 rounded-xl backdrop-blur-md border border-white/10 shrink-0">
            <div>
              <p className="text-xs text-blue-200 font-medium">Total Contracts</p>
              <p className="text-xl md:text-2xl font-black text-white mt-0.5">
                {isLoading ? (
                  <span className="animate-pulse bg-white/20 rounded h-7 w-24 inline-block" />
                ) : (
                  data?.totalContracts?.toLocaleString() ?? '—'
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-blue-200 font-medium">National Budget</p>
              <p className="text-xl md:text-2xl font-black text-white mt-0.5">
                {isLoading ? (
                  <span className="animate-pulse bg-white/20 rounded h-7 w-24 inline-block" />
                ) : (
                  data ? formatCurrency(data.totalBudget) : '—'
                )}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs text-blue-200 font-medium">Data Integrity</p>
              <p className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1">
                <span>✓</span> 100% Official
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Map Component */}
      {data?.regions && (
        <PhilippinesMap stats={data.regions} getColor={getColor} />
      )}

      {/* Regional Anomaly Grid Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              All 18 Philippine Administrative Regions
            </h2>
            <p className="text-xs text-gray-500">
              Select any region below to inspect contracts by district engineering office.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 text-xs font-semibold">
            <button
              onClick={() => setViewMode('map')}
              className={`rounded-md px-3 py-1.5 transition ${
                viewMode === 'map' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              Compact
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`rounded-md px-3 py-1.5 transition ${
                viewMode === 'cards' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              Expanded Cards
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-gray-200 p-5 space-y-3">
                <div className="h-5 w-3/4 rounded bg-gray-200" />
                <div className="h-4 w-1/2 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.regions.map((region) => (
              <button
                key={region.name}
                onClick={() => router.push(`/regions/${encodeURIComponent(region.name)}`)}
                className="group rounded-xl border border-gray-200 bg-white p-5 text-left hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition">
                    {region.name}
                  </h3>
                  <div
                    className="h-3.5 w-3.5 rounded-full shrink-0 border border-white shadow-sm"
                    style={{ backgroundColor: getColor(region.anomalyDensity) }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
                  <span>{region.totalProjects.toLocaleString()} projects</span>
                  <span className="font-semibold text-red-600">
                    {region.flaggedProjects.toLocaleString()} flagged
                  </span>
                </div>

                <div className="mt-1 text-xs text-gray-400">
                  {formatCurrency(region.totalBudget)} total budget
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Anomaly density</span>
                    <span className="font-bold" style={{ color: getColor(region.anomalyDensity) }}>
                      {(region.anomalyDensity * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(region.anomalyDensity * 100, 100)}%`,
                        backgroundColor: getColor(region.anomalyDensity),
                      }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
