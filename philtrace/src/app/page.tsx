'use client';

import Link from 'next/link';
import Image from 'next/image';
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
    if (density >= 0.5) return '#ef4444';
    if (density >= 0.3) return '#f97316';
    if (density >= 0.15) return '#ffb241';
    if (density >= 0.05) return '#84cc16';
    return '#10b981';
  };

  return (
    <div className="w-full bg-[#eeeeee] text-[#01367d] overflow-x-hidden min-h-screen p-0 m-0">

      {/* 1. Full-Width Edge-to-Edge Hero Banner with bg1.png & bg2.png Dual Backdrop */}
      <section className="relative w-full min-h-[85vh] sm:min-h-[88vh] overflow-hidden shadow-2xl flex flex-col justify-between p-6 sm:p-14 lg:p-20 bg-[#011438] text-white">

        {/* Layer 0: Satellite Telemetry Grid Backdrop (bg2.png) */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40 transform scale-110 pointer-events-none z-0"
          style={{ backgroundImage: "url('/bg2.png')" }}
        />

        {/* Layer 0.5: Dramatic Bridge Backdrop Image (bg1.png) */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55 mix-blend-screen transform scale-105 pointer-events-none z-0"
          style={{ backgroundImage: "url('/bg1.png')" }}
        />

        {/* Layer 1: Cinematic Deep Navy & Dark Vignette Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#012456]/85 via-[#01367d]/70 to-[#010e28]/95 pointer-events-none z-0" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40 pointer-events-none z-0" />

        {/* Top Pill Tag */}
        <div className="relative z-10 w-full flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold text-white border border-white/20 backdrop-blur-md shadow-md">
            <span className="h-2 w-2 rounded-full bg-[#ffb241] animate-pulse" />
            PHILIPPINE CIVIC TRANSPARENCY PLATFORM
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs font-semibold text-white/90">
            <span>Real-Time Satellite Proof</span>
            <span>•</span>
            <span>248k Tracked Contracts</span>
          </div>
        </div>

        {/* Hero Center Title & Subtitle with Solid Flat Colors */}
        <div className="relative z-10 w-full my-auto py-8 space-y-6">
          <div className="relative inline-block max-w-full">
            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[7.5vw] xl:text-[8vw] font-black tracking-tighter uppercase leading-none select-none drop-shadow-[0_20px_50px_rgba(0,0,0,0.95)] whitespace-nowrap">
              <span className="text-[#a80101]">MAPA</span>
              <span className="text-[#eeeeee]">TUN</span>
              <span className="text-[#ffb241]">AI</span>
            </h1>
          </div>

          <p className="text-base sm:text-xl lg:text-2xl font-medium text-white/90 max-w-2xl leading-relaxed drop-shadow-md">
            Mapping What&apos;s Real — Exposing Ghost Projects Across the Philippines
          </p>

          {/* Rounded Pill Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/contractors"
              className="flex items-center gap-3 rounded-full bg-white px-8 py-4 text-base font-extrabold text-[#01367d] shadow-xl hover:bg-[#ffb241] hover:scale-105 transition-all duration-200"
            >
              Contractors &rarr;
            </Link>

            <Link
              href="/map"
              className="flex items-center gap-3 rounded-full bg-white/10 px-8 py-4 text-base font-bold text-white border border-white/40 backdrop-blur-md hover:bg-white/20 hover:scale-105 transition-all duration-200"
            >
              Explore Map
            </Link>
          </div>
        </div>

        {/* Subtitle bottom banner */}
        <div className="relative z-10 w-full flex items-center justify-end text-xs sm:text-sm text-white/80 border-t border-white/20 pt-6">
          <p className="font-mono text-[#ffb241] font-bold">DPWH Public Data Verified</p>
        </div>
      </section>

      {/* 2. Full-Width 3 Independent Truth Signals Section */}
      <section className="w-full py-20 px-6 sm:px-12 md:px-16 lg:px-24 bg-[#eeeeee] space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Left Column: Title, Description, Socials, & 3 Circular Metric Icons */}
          <div className="lg:col-span-6 space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-5xl font-black text-[#01367d] tracking-tight leading-tight">
                Why Thousands of Citizens Trust <span className="text-[#a80101]">MAPA</span><span className="text-[#01367d]">TUN</span><span className="text-[#ffb241]">AI</span> for Infrastructure Accountability
              </h2>
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed font-medium">
                Every public infrastructure project in the Philippines is investigated by contrasting three separate layers of evidence: official government records, ground-level citizen reports, and satellite imagery.
              </p>
            </div>

            {/* Trust Chips */}
            <div className="flex items-center gap-4 text-[#01367d]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#01367d] text-white font-bold shadow-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#01367d] text-white font-bold shadow-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2v1.5a2.5 2.5 0 002.5 2.5h.5a2 2 0 012 2v1.935" />
                </svg>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#01367d] text-white font-bold shadow-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <span className="text-xs font-extrabold text-[#01367d] tracking-wide uppercase">
                Verified Civic Data Pipeline
              </span>
            </div>

            {/* 3 Circular Metric Icons Row */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-[#01367d]/15">
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#01367d] text-white shadow-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-2xl font-black text-[#01367d]">
                  {isLoading ? '...' : (data?.totalContracts ? `${Math.round(data.totalContracts / 1000)}k` : '248k')}
                </p>
                <p className="text-xs font-bold text-gray-600 leading-tight">
                  Public Contracts Tracked
                </p>
              </div>

              <div className="text-center space-y-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#01367d] text-white shadow-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-2xl font-black text-[#01367d]">
                  {isLoading ? '...' : (data ? formatCurrency(data.totalBudget) : '₱2.4T+')}
                </p>
                <p className="text-xs font-bold text-gray-600 leading-tight">
                  Infrastructure Funds Tracked
                </p>
              </div>

              <div className="text-center space-y-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#01367d] text-white shadow-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-2xl font-black text-[#01367d]">
                  18
                </p>
                <p className="text-xs font-bold text-gray-600 leading-tight">
                  Regions Covered Across PH
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Stack of 3 Core Transparency Signals (Layer 1, Layer 2, Layer 3) */}
          <div className="lg:col-span-6 space-y-6">

            {/* Layer 1: What The Government Claims */}
            <div className="rounded-3xl bg-[#01367d] text-white p-6 sm:p-8 shadow-xl flex items-start gap-6 border border-[#01367d] hover:shadow-2xl transition-all">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#ffb241] backdrop-blur-md border border-white/20 font-black text-xl">
                L1
              </div>
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-[#ffb241]">Layer 1 — Government Claims</div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">What The Government Claims</h3>
                <p className="text-sm text-white/80 leading-relaxed font-medium">
                  Official data feeds direct from DPWH and national budgets. We track contract amounts, reported physical completion rates, source of funds, and official agency field inspection updates.
                </p>
              </div>
            </div>

            {/* Layer 2: What Citizens Experience */}
            <div className="rounded-3xl bg-[#01367d] text-white p-6 sm:p-8 shadow-xl flex items-start gap-6 border border-[#01367d] hover:shadow-2xl transition-all">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#ffb241] backdrop-blur-md border border-white/20 font-black text-xl">
                L2
              </div>
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-[#ffb241]">Layer 2 — Citizens Experience</div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">What Citizens Experience</h3>
                <p className="text-sm text-white/80 leading-relaxed font-medium">
                  Whistleblower reviews and 5-star quality ratings submitted by local community members on the ground, verified with anti-spam phone OTP and geo-tagged site photos.
                </p>
              </div>
            </div>

            {/* Layer 3: What Satellites Prove */}
            <div className="rounded-3xl bg-[#01367d] text-white p-6 sm:p-8 shadow-xl flex items-start gap-6 border border-[#01367d] hover:shadow-2xl transition-all">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#ffb241] backdrop-blur-md border border-white/20 font-black text-xl">
                L3
              </div>
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-[#ffb241]">Layer 3 — Satellite Proof</div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">What Satellites Prove</h3>
                <p className="text-sm text-white/80 leading-relaxed font-medium">
                  ESRI Wayback satellite before/after split-screen sliders and 360° Google Street View to visually verify whether a ₱100M road or bridge was actually paved or remains bare dirt.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 3. Full-Width Regional Infrastructure Risk Index Grid featuring bg1.png and bg2.png Backdrops */}
      <section className="relative w-full p-8 sm:p-14 lg:p-20 bg-[#01367d] text-white space-y-10 shadow-2xl border-t border-b border-[#01367d]/20">

        {/* Layer 0: Bridge Infrastructure Backdrop (bg1.png) */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: "url('/bg1.png')" }}
        />

        {/* Layer 0.5: Satellite Telemetry Backdrop (bg2.png) */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none"
          style={{ backgroundImage: "url('/bg2.png')" }}
        />

        {/* Layer 1: Dark Tint Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#01367d]/90 via-[#01367d]/85 to-[#01367d]/95 pointer-events-none" />

        <div className="relative z-10 w-full flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/20">
          <div className="space-y-2">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Regional Infrastructure Anomaly Risk
            </h2>
            <p className="text-base sm:text-lg text-white/80 font-medium">
              Select any of the 18 administrative regions across the Philippine archipelago to inspect district engineering offices and contractors.
            </p>
          </div>

          <Link
            href="/map"
            className="flex items-center gap-2 rounded-full bg-[#ffb241] px-6 py-3.5 text-sm font-extrabold text-[#01367d] shadow-lg hover:bg-white transition-all whitespace-nowrap self-start md:self-auto"
          >
            Explore Interactive Map &rarr;
          </Link>
        </div>

        <div className="relative z-10 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.regions.map((region) => (
            <button
              key={region.name}
              onClick={() => router.push(`/map?region=${encodeURIComponent(region.name)}`)}
              className="group rounded-2xl bg-white/10 p-6 text-left hover:bg-white/20 border border-white/15 backdrop-blur-md hover:border-[#ffb241] transition-all duration-200"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-white group-hover:text-[#ffb241] transition-colors">
                  {region.name}
                </h3>
                <div
                  className="h-4 w-4 rounded-full shrink-0 border-2 border-white shadow-md"
                  style={{ backgroundColor: getColor(region.anomalyDensity) }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-white/90">
                <span>{region.totalProjects.toLocaleString()} projects</span>
                <span className="font-bold text-[#ffb241]">
                  {region.flaggedProjects.toLocaleString()} flagged
                </span>
              </div>

              <div className="mt-1 text-xs text-white/70 font-medium">
                {formatCurrency(region.totalBudget)} allocated
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs text-white/80">
                  <span>Anomaly Risk Rating</span>
                  <span className="font-extrabold" style={{ color: getColor(region.anomalyDensity) }}>
                    {(region.anomalyDensity * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-black/40 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
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
      </section>

      {/* 4. Full-Width About MapaTunAI Section */}
      <section className="w-full bg-white py-16 px-6 sm:px-12 text-center space-y-4 border-t border-b border-[#01367d]/10">
        <h3 className="text-2xl sm:text-3xl font-bold text-[#01367d]">About MapaTunAI & UA HOW 2</h3>
        <p className="text-sm sm:text-base text-gray-700 max-w-3xl mx-auto leading-relaxed font-medium">
          MapaTunAI was engineered by UA HOW 2 as a 100% open, public-interest civic technology tool for Philippine governance. Our goal is to transform public data into actionable community power, holding contractors and public works agencies accountable to the Filipino people.
        </p>
        <div className="pt-2 flex justify-center gap-4 text-sm font-extrabold text-[#01367d]">
          <Link href="/map" className="hover:text-[#ffb241] transition-colors">Open Map</Link>
          <span>•</span>
          <Link href="/contractors" className="hover:text-[#ffb241] transition-colors">Contractor Network</Link>
          <span>•</span>
          <Link href="/nearby" className="hover:text-[#ffb241] transition-colors">Near Me Scanner</Link>
        </div>
      </section>

      {/* 5. Full-Width Footer with #eeeeee Background & MAPATUNAI.png Asset */}
      <footer className="w-full py-16 px-6 md:px-16 bg-[#eeeeee] text-[#01367d] border-t border-[#01367d]/15 space-y-8 text-center shadow-inner">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-center">
            <Image
              src="/MAPATUNAI.png"
              alt="MAPATUNAI Logo"
              width={180}
              height={50}
              className="h-10 w-auto object-contain"
            />
          </div>
          <p className="text-sm text-[#01367d]/80 leading-relaxed font-medium">
            MapaTunAI is a public-interest civic platform designed to provide every Filipino taxpayer with satellite proof and ground-truth data to hold public works accountable.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-bold text-[#01367d]">
          <Link href="/map" className="hover:text-[#ffb241] transition-colors">National Map</Link>
          <span>•</span>
          <Link href="/contractors" className="hover:text-[#ffb241] transition-colors">Contractor Registry</Link>
          <span>•</span>
          <Link href="/nearby" className="hover:text-[#ffb241] transition-colors">Near Me Scanner</Link>
        </div>

        <p className="text-xs text-[#01367d]/60 font-semibold">
          &copy; {new Date().getFullYear()} MapaTunAI. All public contract metrics sourced from official DPWH disclosures & verified citizen ground reports.
        </p>
      </footer>
    </div>
  );
}
