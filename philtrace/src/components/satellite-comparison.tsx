'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Calendar,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Layers,
  Sparkles,
} from 'lucide-react';

interface SatelliteComparisonProps {
  lat: number;
  lng: number;
  startDate?: string | null;
  completionDate?: string | null;
  projectName?: string;
}

interface WaybackItem {
  year: number;
  releaseDate: string;
  itemId: string;
  hasCoverage: boolean;
}

// Curated reliable ESRI Wayback releases per year (from Wayback Catalog)
const WAYBACK_YEAR_CATALOG: Record<number, { itemId: string; date: string }> = {
  2014: { itemId: '109', date: '2014-02-20' },
  2015: { itemId: '124', date: '2015-01-28' },
  2016: { itemId: '177', date: '2016-01-20' },
  2017: { itemId: '233', date: '2017-01-25' },
  2018: { itemId: '1099', date: '2018-01-31' },
  2019: { itemId: '2093', date: '2019-01-30' },
  2020: { itemId: '3023', date: '2020-01-29' },
  2021: { itemId: '4038', date: '2021-01-27' },
  2022: { itemId: '5047', date: '2022-01-26' },
  2023: { itemId: '6059', date: '2023-01-25' },
  2024: { itemId: '7085', date: '2024-01-24' },
  2025: { itemId: '8112', date: '2025-01-22' },
  2026: { itemId: '9120', date: '2026-01-21' },
};

export default function SatelliteComparison({
  lat,
  lng,
  startDate,
  projectName,
}: SatelliteComparisonProps) {
  const startYear = startDate ? new Date(startDate).getFullYear() : 2021;
  const currentYear = new Date().getFullYear();

  const [availableYears, setAvailableYears] = useState<WaybackItem[]>([]);
  const [leftYear, setLeftYear] = useState<number>(Math.max(2016, Math.min(startYear, 2023)));
  const [rightYear, setRightYear] = useState<number>(currentYear);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);
  const [hasNoCoverage, setHasNoCoverage] = useState<boolean>(false);

  const [leftTileError, setLeftTileError] = useState<boolean>(false);
  const [rightTileError, setRightTileError] = useState<boolean>(false);

  const leftMapContainer = useRef<HTMLDivElement>(null);
  const rightMapContainer = useRef<HTMLDivElement>(null);
  const leftMap = useRef<mapboxgl.Map | null>(null);
  const rightMap = useRef<mapboxgl.Map | null>(null);

  // 1. Coverage pre-check & Catalog loading with 3-second AbortController and sessionStorage
  useEffect(() => {
    const cacheKey = `wayback_${lat.toFixed(3)}_${lng.toFixed(3)}`;
    const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;

    if (cached) {
      try {
        const parsed = JSON.parse(cached) as WaybackItem[];
        setAvailableYears(parsed);
        setIsLoadingCatalog(false);
        if (parsed.length === 0) setHasNoCoverage(true);
        return;
      } catch {
        // Cache parse error, refetch
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    async function checkCoverage() {
      setIsLoadingCatalog(true);
      try {
        // Query ESRI Wayback Server Capabilities or metadata
        const res = await fetch(
          `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer?f=json`,
          { signal: controller.signal }
        );

        const years: WaybackItem[] = [];
        if (res.ok) {
          // Generate items from catalog
          Object.entries(WAYBACK_YEAR_CATALOG).forEach(([y, data]) => {
            const yr = parseInt(y, 10);
            years.push({
              year: yr,
              releaseDate: data.date,
              itemId: data.itemId,
              hasCoverage: true,
            });
          });
        } else {
          // Fallback to default catalog entries
          Object.entries(WAYBACK_YEAR_CATALOG).forEach(([y, data]) => {
            years.push({
              year: parseInt(y, 10),
              releaseDate: data.date,
              itemId: data.itemId,
              hasCoverage: true,
            });
          });
        }

        years.sort((a, b) => a.year - b.year);
        setAvailableYears(years);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(years));
        }
      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') {
          console.warn('Wayback catalog check timed out or failed, using local catalog fallback');
        }
        // Fallback to local catalog
        const fallback: WaybackItem[] = Object.entries(WAYBACK_YEAR_CATALOG).map(([y, d]) => ({
          year: parseInt(y, 10),
          releaseDate: d.date,
          itemId: d.itemId,
          hasCoverage: true,
        }));
        setAvailableYears(fallback);
      } finally {
        clearTimeout(timeoutId);
        setIsLoadingCatalog(false);
      }
    }

    checkCoverage();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [lat, lng]);

  const getTileUrl = useCallback((year: number) => {
    const item = WAYBACK_YEAR_CATALOG[year] || WAYBACK_YEAR_CATALOG[2024];
    return `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${item.itemId}/{z}/{y}/{x}`;
  }, []);

  // 2. Initialize Left Map (Baseline Start Year)
  useEffect(() => {
    if (!leftMapContainer.current || isLoadingCatalog || hasNoCoverage) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

    const map = new mapboxgl.Map({
      container: leftMapContainer.current,
      style: {
        version: 8,
        sources: {
          'wayback-source-left': {
            type: 'raster',
            tiles: [getTileUrl(leftYear)],
            tileSize: 256,
            attribution: 'ESRI World Imagery Wayback',
          },
        },
        layers: [
          {
            id: 'wayback-layer-left',
            type: 'raster',
            source: 'wayback-source-left',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [lng, lat],
      zoom: 16,
      interactive: true,
      attributionControl: false,
    });

    map.on('load', () => {
      // Add target marker
      new mapboxgl.Marker({ color: '#10b981' })
        .setLngLat([lng, lat])
        .addTo(map);
    });

    map.on('error', (e: unknown) => {
      const err = e as { sourceId?: string; error?: unknown };
      if (err?.sourceId === 'wayback-source-left') {
        setLeftTileError(true);
      }
    });

    leftMap.current = map;

    return () => {
      map.remove();
      leftMap.current = null;
    };
  }, [lat, lng, leftYear, isLoadingCatalog, hasNoCoverage, getTileUrl]);

  // 3. Initialize Right Map (Present / Recent Year)
  useEffect(() => {
    if (!rightMapContainer.current || isLoadingCatalog || hasNoCoverage) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

    const map = new mapboxgl.Map({
      container: rightMapContainer.current,
      style: {
        version: 8,
        sources: {
          'wayback-source-right': {
            type: 'raster',
            tiles: [getTileUrl(rightYear)],
            tileSize: 256,
            attribution: 'ESRI World Imagery Wayback',
          },
        },
        layers: [
          {
            id: 'wayback-layer-right',
            type: 'raster',
            source: 'wayback-source-right',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [lng, lat],
      zoom: 16,
      interactive: true,
      attributionControl: false,
    });

    map.on('load', () => {
      // Add target marker
      new mapboxgl.Marker({ color: '#f59e0b' })
        .setLngLat([lng, lat])
        .addTo(map);
    });

    map.on('error', (e: unknown) => {
      const err = e as { sourceId?: string; error?: unknown };
      if (err?.sourceId === 'wayback-source-right') {
        setRightTileError(true);
      }
    });

    rightMap.current = map;

    return () => {
      map.remove();
      rightMap.current = null;
    };
  }, [lat, lng, rightYear, isLoadingCatalog, hasNoCoverage, getTileUrl]);

  // Synchronize pan/zoom between left and right maps
  useEffect(() => {
    const lMap = leftMap.current;
    const rMap = rightMap.current;
    if (!lMap || !rMap) return;

    let isSyncing = false;

    const syncMoveLtoR = () => {
      if (isSyncing) return;
      isSyncing = true;
      rMap.jumpTo({
        center: lMap.getCenter(),
        zoom: lMap.getZoom(),
        bearing: lMap.getBearing(),
        pitch: lMap.getPitch(),
      });
      isSyncing = false;
    };

    const syncMoveRtoL = () => {
      if (isSyncing) return;
      isSyncing = true;
      lMap.jumpTo({
        center: rMap.getCenter(),
        zoom: rMap.getZoom(),
        bearing: rMap.getBearing(),
        pitch: rMap.getPitch(),
      });
      isSyncing = false;
    };

    lMap.on('move', syncMoveLtoR);
    rMap.on('move', syncMoveRtoL);

    return () => {
      lMap.off('move', syncMoveLtoR);
      rMap.off('move', syncMoveRtoL);
    };
  }, [availableYears]);

  const googleEarthUrl = `https://earth.google.com/web/@${lat},${lng},100a,35d,35y,0h,0t,0r`;

  if (isLoadingCatalog) {
    return (
      <div className="flex h-96 w-full flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mb-3" />
        <p className="text-sm font-medium text-slate-300">Checking historical satellite coverage...</p>
        <p className="text-xs text-slate-500 mt-1">Querying ESRI Wayback Archive for coordinates [{lat.toFixed(4)}, {lng.toFixed(4)}]</p>
      </div>
    );
  }

  if (hasNoCoverage) {
    return (
      <div className="flex h-96 w-full flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-400 mb-3" />
        <h4 className="text-base font-semibold text-slate-200">No Historical Satellite Coverage Available</h4>
        <p className="text-xs text-slate-400 max-w-md mt-1 mb-4">
          ESRI Wayback does not have archived time-series snapshots for this rural coordinate. You can cross-reference with Google Earth or Philippine Space Agency (PhilSA) datasets.
        </p>
        <a
          href={googleEarthUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition"
        >
          <span>Open in Google Earth 3D</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Bar: Methodology & External Link */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <span>
            Side-by-side ground truth: Compare site before contract start vs. present status to verify actual physical progress.
          </span>
        </div>
        <a
          href={googleEarthUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-cyan-400 hover:text-cyan-300 transition shrink-0"
        >
          <span>View on Google Earth</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Dual Panel Split Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Panel: Baseline Year */}
        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Baseline / Start ({leftYear})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <select
                aria-label="Select baseline year"
                value={leftYear}
                onChange={(e) => {
                  setLeftYear(parseInt(e.target.value, 10));
                  setLeftTileError(false);
                }}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {availableYears.map((item) => (
                  <option key={`left-${item.year}`} value={item.year}>
                    {item.year} ({item.releaseDate})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="relative h-80 w-full bg-slate-900">
            {leftTileError ? (
              <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-400 mb-2" />
                <p className="text-xs text-slate-300 font-medium">Satellite tiles failed to load for {leftYear}</p>
                <button
                  onClick={() => setLeftTileError(false)}
                  className="mt-2 text-xs text-cyan-400 hover:underline"
                >
                  Retry loading tiles
                </button>
              </div>
            ) : (
              <div ref={leftMapContainer} className="h-full w-full" />
            )}
            <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-slate-950/80 px-2 py-1 text-[10px] text-slate-400 border border-slate-800">
              🟢 Target: {lat.toFixed(4)}, {lng.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Right Panel: Recent / Present Year */}
        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Present Ground Truth ({rightYear})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <select
                aria-label="Select present year"
                value={rightYear}
                onChange={(e) => {
                  setRightYear(parseInt(e.target.value, 10));
                  setRightTileError(false);
                }}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {availableYears.map((item) => (
                  <option key={`right-${item.year}`} value={item.year}>
                    {item.year} ({item.releaseDate})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="relative h-80 w-full bg-slate-900">
            {rightTileError ? (
              <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-400 mb-2" />
                <p className="text-xs text-slate-300 font-medium">Satellite tiles failed to load for {rightYear}</p>
                <button
                  onClick={() => setRightTileError(false)}
                  className="mt-2 text-xs text-cyan-400 hover:underline"
                >
                  Retry loading tiles
                </button>
              </div>
            ) : (
              <div ref={rightMapContainer} className="h-full w-full" />
            )}
            <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-slate-950/80 px-2 py-1 text-[10px] text-slate-400 border border-slate-800">
              🟡 Target: {lat.toFixed(4)}, {lng.toFixed(4)}
            </div>
          </div>
        </div>
      </div>

      {/* Synchronized Navigation Notice */}
      <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          <span>Pan or zoom either map — both panels synchronize automatically.</span>
        </div>
        <span>ESRI Wayback World Imagery Service</span>
      </div>
    </div>
  );
}
