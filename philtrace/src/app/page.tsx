'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/format';

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
        <p className="text-red-600">Failed to load data. Please try again.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary bar */}
      <div className="mb-6 rounded-lg bg-white border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {isLoading ? (
                <span className="animate-pulse bg-gray-200 rounded h-8 w-32 inline-block" />
              ) : (
                data?.totalContracts?.toLocaleString() ?? '—'
              )}
            </p>
            <p className="text-xs text-gray-500">Total Contracts</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {isLoading ? (
                <span className="animate-pulse bg-gray-200 rounded h-8 w-32 inline-block" />
              ) : (
                data ? formatCurrency(data.totalBudget) : '—'
              )}
            </p>
            <p className="text-xs text-gray-500">Total Budget</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">
              Last sync: {data?.lastSync ? new Date(data.lastSync).toLocaleString('en-PH') : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Region cards (choropleth placeholder until react-simple-maps is configured) */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Philippine Regions — Infrastructure Anomaly Density
      </h2>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-gray-200 p-4">
              <div className="h-5 w-3/4 rounded bg-gray-200 mb-2" />
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
              className="rounded-lg border border-gray-200 p-4 text-left hover:border-blue-300 hover:shadow-md transition-all bg-white"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">{region.name}</h3>
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: getColor(region.anomalyDensity) }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>{region.totalProjects.toLocaleString()} projects</span>
                <span>{region.flaggedProjects} flagged</span>
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {formatCurrency(region.totalBudget)} total budget
              </div>
              <div className="mt-2">
                <div className="h-1.5 w-full rounded-full bg-gray-200">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(region.anomalyDensity * 100, 100)}%`,
                      backgroundColor: getColor(region.anomalyDensity),
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {(region.anomalyDensity * 100).toFixed(1)}% anomaly density
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="font-medium">Anomaly Density:</span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Low (&lt;5%)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-lime-500" /> Moderate (5-15%)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> Elevated (15-30%)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> High (30-50%)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Critical (&gt;50%)
        </span>
      </div>
    </div>
  );
}
