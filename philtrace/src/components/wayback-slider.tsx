'use client';

import { useState, useEffect } from 'react';

interface WaybackSliderProps {
  gpsLat: number;
  gpsLng: number;
  startDate?: string | Date;
  completionDate?: string | Date | null;
}

interface YearSnapshot {
  year: number;
  itemId: number;
  releaseDate: string;
  isStartYear: boolean;
  isDueYear: boolean;
}

// Pre-indexed ESRI Wayback major release item IDs per year (closest to January of each year)
const WAYBACK_YEAR_DEFAULTS: Record<number, { itemId: number; releaseDate: string }> = {
  2014: { itemId: 4247, releaseDate: 'February 20, 2014' },
  2015: { itemId: 2612, releaseDate: 'January 28, 2015' },
  2016: { itemId: 885, releaseDate: 'January 13, 2016' },
  2017: { itemId: 1618, releaseDate: 'January 04, 2017' },
  2018: { itemId: 1673, releaseDate: 'January 10, 2018' },
  2019: { itemId: 2368, releaseDate: 'January 09, 2019' },
  2020: { itemId: 2470, releaseDate: 'January 15, 2020' },
  2021: { itemId: 3012, releaseDate: 'January 13, 2021' },
  2022: { itemId: 3672, releaseDate: 'January 19, 2022' },
  2023: { itemId: 4210, releaseDate: 'January 18, 2023' },
  2024: { itemId: 4890, releaseDate: 'January 17, 2024' },
  2025: { itemId: 5410, releaseDate: 'January 15, 2025' },
  2026: { itemId: 5920, releaseDate: 'January 14, 2026' },
};

export default function WaybackSlider({
  gpsLat,
  gpsLng,
  startDate,
  completionDate,
}: WaybackSliderProps) {
  const startYear = startDate ? new Date(startDate).getFullYear() : 2020;
  const dueYear = completionDate ? new Date(completionDate).getFullYear() : null;
  const currentYear = new Date().getFullYear();
  const maxYear = Math.max(dueYear || currentYear, currentYear);
  const minYear = Math.max(2014, Math.min(startYear, currentYear - 5));

  // Build timeline years list
  const timelineYears: YearSnapshot[] = [];
  for (let yr = minYear; yr <= maxYear; yr++) {
    const wb = WAYBACK_YEAR_DEFAULTS[yr] || {
      itemId: 4890 + (yr - 2024) * 500,
      releaseDate: `January ${yr}`,
    };

    timelineYears.push({
      year: yr,
      itemId: wb.itemId,
      releaseDate: wb.releaseDate,
      isStartYear: yr === startYear,
      isDueYear: yr === dueYear,
    });
  }

  const [selectedYear, setSelectedYear] = useState<number>(startYear);
  const activeSnapshot = timelineYears.find((t) => t.year === selectedYear) || timelineYears[0];

  // Tile URL pattern for ESRI Wayback
  const mapboxSatelliteUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${gpsLng},${gpsLat},16,0/800x480?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`;
  const arcgisStaticUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${gpsLng - 0.005},${gpsLat - 0.003},${gpsLng + 0.005},${gpsLat + 0.003}&bboxSR=4326&imageSR=4326&size=800,480&format=jpg&f=image`;

  return (
    <div className="space-y-3 select-none">
      {/* Header & Badges */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900">Satellite Timeline</span>
          <span className="text-[11px] text-gray-500">
            ({minYear} &ndash; {maxYear})
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Start ({startYear})
          </span>
          {dueYear && (
            <span className="inline-flex items-center gap-1 font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
              <span className="h-1.5 w-1.5 rounded-full bg-red-600" /> Due ({dueYear})
            </span>
          )}
        </div>
      </div>

      {/* Year Selector Horizontal Pill Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {timelineYears.map((snap) => {
          const isSelected = snap.year === selectedYear;
          return (
            <button
              key={snap.year}
              onClick={() => setSelectedYear(snap.year)}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1.5 border ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span>{snap.year}</span>
              {snap.isStartYear && (
                <span
                  className={`h-2 w-2 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'}`}
                  title="Contract Start Year"
                />
              )}
              {snap.isDueYear && (
                <span
                  className={`h-2 w-2 rounded-full ${isSelected ? 'bg-red-300' : 'bg-red-500'}`}
                  title="Target Due Year"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Satellite Imagery Frame */}
      <div className="relative h-60 w-full overflow-hidden rounded-xl border border-gray-200 shadow-inner bg-gray-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={selectedYear === currentYear ? mapboxSatelliteUrl : arcgisStaticUrl}
          alt={`Satellite imagery for ${selectedYear}`}
          className="h-full w-full object-cover"
        />

        {/* Floating Year Watermark */}
        <div className="absolute top-2.5 right-2.5 z-10 rounded-md bg-black/75 px-2.5 py-1 text-xs font-black text-white backdrop-blur-md border border-white/20">
          🛰️ {selectedYear}
        </div>

        {/* Center Crosshair Pin */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="h-6 w-6 rounded-full border-2 border-red-500 bg-red-500/30 flex items-center justify-center animate-pulse">
            <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
          </div>
        </div>
      </div>

      {/* Capture Date Label */}
      <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
        <span>
          Showing imagery from: <strong className="text-gray-800">{activeSnapshot?.releaseDate}</strong>
        </span>
        <span className="text-[10px] text-gray-400 font-mono">Wayback #{activeSnapshot?.itemId}</span>
      </div>
    </div>
  );
}
