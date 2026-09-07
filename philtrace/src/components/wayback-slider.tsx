'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface WaybackSliderProps {
  gpsLat: number;
  gpsLng: number;
  startDate?: string | Date;
  completionDate?: string | Date | null;
}

interface WaybackRelease {
  year: number;
  m: string;
  name: string;
  releaseDate: string;
  isStartYear: boolean;
  isDueYear: boolean;
}

// Verified ESRI Wayback MapServer release identifiers (closest to year-end / major update per year)
export const ESRI_WAYBACK_RELEASES: Record<number, { m: string; name: string; releaseDate: string }> = {
  2014: { m: '5844', name: 'WB_2014_R21', releaseDate: 'Dec 30, 2014' },
  2015: { m: '28163', name: 'WB_2015_R23', releaseDate: 'Dec 16, 2015' },
  2016: { m: '18966', name: 'WB_2016_R22', releaseDate: 'Dec 20, 2016' },
  2017: { m: '25521', name: 'WB_2017_R19', releaseDate: 'Nov 16, 2017' },
  2018: { m: '23448', name: 'WB_2018_R17', releaseDate: 'Dec 14, 2018' },
  2019: { m: '4756', name: 'WB_2019_R16', releaseDate: 'Dec 12, 2019' },
  2020: { m: '29260', name: 'WB_2020_R16', releaseDate: 'Dec 16, 2020' },
  2021: { m: '26120', name: 'WB_2021_R17', releaseDate: 'Dec 21, 2021' },
  2022: { m: '45134', name: 'WB_2022_R15', releaseDate: 'Dec 14, 2022' },
  2023: { m: '56102', name: 'WB_2023_R11', releaseDate: 'Dec 07, 2023' },
  2024: { m: '16453', name: 'WB_2024_R13', releaseDate: 'Dec 12, 2024' },
  2025: { m: '13192', name: 'WB_2025_R12', releaseDate: 'Dec 18, 2025' },
  2026: { m: '26334', name: 'WB_2026_R07', releaseDate: 'Aug 05, 2026' },
};

export default function WaybackSlider({
  gpsLat,
  gpsLng,
  startDate,
  completionDate,
}: WaybackSliderProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const startYear = startDate ? new Date(startDate).getFullYear() : 2020;
  const dueYear = completionDate ? new Date(completionDate).getFullYear() : null;

  // Build timeline years list (2014 to 2026)
  const timelineYears: WaybackRelease[] = useMemo(() => {
    const list: WaybackRelease[] = [];
    const minYear = 2014;
    const maxYear = 2026;

    for (let yr = minYear; yr <= maxYear; yr++) {
      const entry = ESRI_WAYBACK_RELEASES[yr] || ESRI_WAYBACK_RELEASES[2026];
      list.push({
        year: yr,
        m: entry.m,
        name: entry.name,
        releaseDate: entry.releaseDate,
        isStartYear: yr === startYear,
        isDueYear: yr === dueYear,
      });
    }
    return list;
  }, [startYear, dueYear]);

  // Default to project start year (or 2020 if startYear < 2014)
  const initialYear = Math.max(2014, Math.min(startYear, 2026));
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [compareMode, setCompareMode] = useState<boolean>(false);

  const activeRelease = useMemo(() => {
    return timelineYears.find((t) => t.year === selectedYear) || timelineYears[timelineYears.length - 1];
  }, [timelineYears, selectedYear]);

  const startRelease = useMemo(() => {
    return timelineYears.find((t) => t.year === initialYear) || timelineYears[0];
  }, [timelineYears, initialYear]);

  // Helper to construct ESRI Wayback tile URL template
  const getWaybackTileUrl = useCallback((m: string) => {
    return `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${m}/{z}/{y}/{x}`;
  }, []);

  // Initialize Mapbox instance with custom ESRI Wayback raster source
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    // Validate coordinates
    const lat = Number.isFinite(gpsLat) ? gpsLat : 14.5995;
    const lng = Number.isFinite(gpsLng) ? gpsLng : 120.9842;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      maxZoom: 18,
      style: {
        version: 8,
        sources: {
          'esri-wayback': {
            type: 'raster',
            tiles: [getWaybackTileUrl(activeRelease.m)],
            tileSize: 256,
            maxzoom: 18,
            attribution: 'Esri, Maxar, Earthstar Geographics',
          },
        },
        layers: [
          {
            id: 'esri-wayback-layer',
            type: 'raster',
            source: 'esri-wayback',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [lng, lat],
      zoom: 16,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      setMapLoaded(true);
      map.resize();
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [gpsLat, gpsLng, getWaybackTileUrl]);

  // Update tile layer whenever selected year / release changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const source = map.getSource('esri-wayback') as mapboxgl.RasterTileSource | undefined;
    if (source && typeof source.setTiles === 'function') {
      source.setTiles([getWaybackTileUrl(activeRelease.m)]);
    } else {
      if (map.getLayer('esri-wayback-layer')) {
        map.removeLayer('esri-wayback-layer');
      }
      if (map.getSource('esri-wayback')) {
        map.removeSource('esri-wayback');
      }

      map.addSource('esri-wayback', {
        type: 'raster',
        tiles: [getWaybackTileUrl(activeRelease.m)],
        tileSize: 256,
        maxzoom: 18,
      });

      map.addLayer({
        id: 'esri-wayback-layer',
        type: 'raster',
        source: 'esri-wayback',
        minzoom: 0,
        maxzoom: 19,
      });
    }
  }, [activeRelease, mapLoaded, getWaybackTileUrl]);

  return (
    <div className="space-y-2.5 select-none text-xs">
      {/* Header & Badges */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900">ESRI Wayback Timeline</span>
          <span className="text-[10px] text-gray-500 font-mono">
            (2014 &ndash; 2026)
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px]">
          <button
            onClick={() => {
              if (!compareMode) {
                setSelectedYear(selectedYear === initialYear ? 2026 : initialYear);
              }
              setCompareMode(!compareMode);
            }}
            className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 border ${
              compareMode
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            ⚡ {compareMode ? 'Exit Compare' : 'Start vs Now'}
          </button>
        </div>
      </div>

      {/* Compare Quick Toggle Pill */}
      {compareMode && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-1.5 text-[11px]">
          <span className="text-amber-800 font-semibold">Comparing Ground Truth:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedYear(initialYear)}
              className={`px-2 py-0.5 rounded font-bold transition ${
                selectedYear === initialYear
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-emerald-800 border border-emerald-300'
              }`}
            >
              Start ({startRelease.year})
            </button>
            <span className="text-amber-500 font-bold">vs</span>
            <button
              onClick={() => setSelectedYear(2026)}
              className={`px-2 py-0.5 rounded font-bold transition ${
                selectedYear === 2026
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-blue-800 border border-blue-300'
              }`}
            >
              Latest (2026)
            </button>
          </div>
        </div>
      )}

      {/* Year Selector Horizontal Pill Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {timelineYears.map((snap) => {
          const isSelected = snap.year === selectedYear;
          return (
            <button
              key={snap.year}
              onClick={() => {
                setSelectedYear(snap.year);
                if (compareMode) setCompareMode(false);
              }}
              className={`relative px-2.5 py-1 rounded-md text-[11px] font-bold transition shrink-0 flex items-center gap-1 border ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm scale-105'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span>{snap.year}</span>
              {snap.isStartYear && (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'}`}
                  title={`Contract Start (${snap.year})`}
                />
              )}
              {snap.isDueYear && (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-red-300' : 'bg-red-500'}`}
                  title={`Target Due (${snap.year})`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Satellite Map Container */}
      <div className="relative h-64 w-full overflow-hidden rounded-xl border border-gray-200 shadow-inner bg-gray-950">
        <div ref={mapContainerRef} className="h-full w-full" />

        {/* Loading Overlay */}
        {!mapLoaded && (
          <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-xs flex items-center justify-center text-white text-xs gap-2">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Loading {activeRelease.year} Satellite Imagery...
          </div>
        )}

        {/* Floating Release Badge */}
        <div className="absolute top-2.5 left-2.5 z-10 rounded-md bg-black/80 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md border border-white/20 shadow-md">
          🛰️ ESRI Wayback {activeRelease.year} &middot;{' '}
          <span className="text-emerald-400 font-mono">{activeRelease.releaseDate}</span>
        </div>

        {/* Center Crosshair Pin */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
          <div className="h-7 w-7 rounded-full border-2 border-red-500 bg-red-500/25 flex items-center justify-center animate-pulse">
            <div className="h-2 w-2 rounded-full bg-red-500 ring-2 ring-white/80" />
          </div>
        </div>

        {/* Zoom Hint */}
        <div className="absolute bottom-2 left-2 z-10 bg-black/60 backdrop-blur-xs text-[10px] text-gray-300 px-2 py-0.5 rounded">
          Drag to Pan &middot; Scroll to Zoom
        </div>
      </div>

      {/* Capture Metadata Bar */}
      <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
        <span>
          Capture Date: <strong className="text-gray-800">{activeRelease.releaseDate}</strong>
        </span>
        <span className="text-[10px] text-gray-400 font-mono">
          Release: {activeRelease.name} (m={activeRelease.m})
        </span>
      </div>
    </div>
  );
}
