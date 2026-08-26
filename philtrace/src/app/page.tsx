'use client';

import Link from 'next/link';
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

export default function AboutAndHomePage() {
  const router = useRouter();

  const { data, isLoading } = useQuery<HomeData>({
    queryKey: ['home-stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const getColor = (density: number): string => {
    if (density >= 0.5) return '#dc2626';
    if (density >= 0.3) return '#ea580c';
    if (density >= 0.15) return '#eab308';
    if (density >= 0.05) return '#84cc16';
    return '#22c55e';
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Mission Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-8 sm:p-12 text-white shadow-2xl border border-white/10">
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3.5 py-1 text-xs font-bold text-blue-300 backdrop-blur-md border border-blue-400/20">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            OFFICIAL PHILIPPINE CIVIC TRANSPARENCY PLATFORM
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Google Maps for Philippine Public Works & Infrastructure.
          </h1>

          <p className="text-sm sm:text-base text-blue-200/90 leading-relaxed max-w-2xl">
            PhilTrace empowers every Filipino taxpayer to investigate, review, and audit all DPWH infrastructure contracts — cross-referencing official claims with verified citizen reports and satellite ground truth.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/map"
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-500 hover:scale-105 transition-all"
            >
              <span>🗺️</span> Open National Interactive Map &rarr;
            </Link>

            <Link
              href="/contractors"
              className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/20 border border-white/15 backdrop-blur-md transition"
            >
              <span>🏢</span> Contractor Leaderboard
            </Link>
          </div>
        </div>

        {/* National Stats Ribbon */}
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-white/10 pt-8">
          <div>
            <span className="text-xs text-blue-300 font-medium">Public Contracts Audited</span>
            <p className="text-2xl sm:text-3xl font-black text-white mt-0.5">
              {isLoading ? '...' : (data?.totalContracts?.toLocaleString() ?? '248,220')}
            </p>
          </div>
          <div>
            <span className="text-xs text-blue-300 font-medium">Total Public Funds Tracked</span>
            <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-0.5">
              {isLoading ? '...' : (data ? formatCurrency(data.totalBudget) : '₱2.4T+')}
            </p>
          </div>
          <div>
            <span className="text-xs text-blue-300 font-medium">Contractor Track Records</span>
            <p className="text-2xl sm:text-3xl font-black text-white mt-0.5">11,162</p>
          </div>
          <div>
            <span className="text-xs text-blue-300 font-medium">National Coverage</span>
            <p className="text-2xl sm:text-3xl font-black text-blue-400 mt-0.5">18 Regions</p>
          </div>
        </div>
      </div>

      {/* The 3 Core Transparency Signals */}
      <div className="space-y-4">
        <div className="text-center max-w-xl mx-auto">
          <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600">The PhilTrace Method</span>
          <h2 className="text-2xl font-bold text-gray-900 mt-1">
            The 3 Independent Truth Signals
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Every public infrastructure project in the Philippines is audited by contrasting three separate layers of evidence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-6 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-2xl text-white shadow-md">
              🏛️
            </div>
            <h3 className="text-base font-bold text-gray-900">1. What The Government Claims</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Official data feeds direct from DPWH and national budgets. We track contract amounts, reported completion rates, source of funds, and official agency field inspection updates.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-2xl text-white shadow-md">
              ⭐
            </div>
            <h3 className="text-base font-bold text-gray-900">2. What Citizens Experience</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Whistleblower reviews and 5-star quality ratings submitted by local community members on the ground, verified with anti-spam phone OTP and real site photos.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-2xl text-white shadow-md">
              🛰️
            </div>
            <h3 className="text-base font-bold text-gray-900">3. What Satellites Prove</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              ESRI Wayback satellite before/after split-screen sliders and 360° Google Street View to visually verify whether a ₱100M road or bridge was actually paved or remains bare dirt.
            </p>
          </div>
        </div>
      </div>

      {/* Regional Infrastructure Anomaly Density */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Regional Infrastructure Anomaly Risk
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Select any of the 18 administrative regions to inspect district engineering offices and contractors.
            </p>
          </div>

          <Link
            href="/map"
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition"
          >
            Explore in Full-Screen Map &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.regions.map((region) => (
            <button
              key={region.name}
              onClick={() => router.push(`/map?region=${encodeURIComponent(region.name)}`)}
              className="group rounded-xl border border-gray-200 p-4 text-left hover:border-blue-400 hover:shadow-md transition-all bg-white"
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

              <div className="mt-2.5 flex items-center justify-between text-xs text-gray-600">
                <span>{region.totalProjects.toLocaleString()} projects</span>
                <span className="font-bold text-red-600">
                  {region.flaggedProjects.toLocaleString()} flagged
                </span>
              </div>

              <div className="mt-1 text-xs text-gray-400">
                {formatCurrency(region.totalBudget)} total budget
              </div>

              <div className="mt-2.5">
                <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                  <span>Anomaly Risk</span>
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
      </div>

      {/* About Creators & Hackathon Mission */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8 text-center space-y-3">
        <span className="text-2xl">🇵🇭</span>
        <h3 className="text-base font-bold text-gray-900">About PhilTrace & The Civic Team</h3>
        <p className="text-xs text-gray-600 max-w-xl mx-auto leading-relaxed">
          PhilTrace was engineered as a 100% open, public-interest civic technology tool for the Philippine governance hackathon. Our goal is to transform public data into actionable community power, holding contractors and public works agencies accountable to the Filipino people.
        </p>
        <div className="pt-2 flex justify-center gap-4 text-xs font-semibold text-blue-600">
          <Link href="/map" className="hover:underline">Open Map</Link>
          <span>•</span>
          <Link href="/contractors" className="hover:underline">Contractor Network</Link>
          <span>•</span>
          <Link href="/nearby" className="hover:underline">Near Me Scanner</Link>
        </div>
      </div>
    </div>
  );
}
