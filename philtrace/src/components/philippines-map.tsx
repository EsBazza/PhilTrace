'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { geoMercator, geoPath } from 'd3-geo';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { formatCurrency } from '@/lib/format';

interface RegionStat {
  name: string;
  totalProjects: number;
  flaggedProjects: number;
  totalBudget: number;
  anomalyDensity: number;
}

interface PhilippinesMapProps {
  stats: RegionStat[];
  getColor: (density: number) => string;
}

const REGION_NAME_MAP: Record<string, string> = {
  'Autonomous Region of Muslim Mindanao (ARMM)': 'BARMM',
  'Bicol Region (Region V)': 'Region V',
  'CALABARZON (Region IV-A)': 'Region IV-A',
  'Cagayan Valley (Region II)': 'Region II',
  'Caraga (Region XIII)': 'Region XIII',
  'Central Luzon (Region III)': 'Region III',
  'Central Visayas (Region VII)': 'Region VII',
  'Cordillera Administrative Region (CAR)': 'Cordillera Administrative Region',
  'Davao Region (Region XI)': 'Region XI',
  'Eastern Visayas (Region VIII)': 'Region VIII',
  'Ilocos Region (Region I)': 'Region I',
  'MIMAROPA (Region IV-B)': 'Region IV-B',
  'Metropolitan Manila': 'National Capital Region',
  'Northern Mindanao (Region X)': 'Region X',
  'SOCCSKSARGEN (Region XII)': 'Region XII',
  'Western Visayas (Region VI)': 'Region VI',
  'Zamboanga Peninsula (Region IX)': 'Region IX',
};

export default function PhilippinesMap({ stats, getColor }: PhilippinesMapProps) {
  const router = useRouter();
  const [geoData, setGeoData] = useState<any>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<'choropleth' | 'satellite'>('choropleth');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // Map stats by db name
  const statsMap = useMemo(() => {
    const map = new Map<string, RegionStat>();
    for (const s of stats) {
      map.set(s.name, s);
    }
    return map;
  }, [stats]);

  // Load GeoJSON
  useEffect(() => {
    fetch('/data/ph-regions.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setGeoData(data);
      })
      .catch((err) => console.error('Failed to load PH GeoJSON:', err));
  }, []);

  // Initialize Mapbox Satellite when switched to satellite mode
  useEffect(() => {
    if (mapMode !== 'satellite' || !mapContainerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [122.0, 13.0],
      zoom: 5.5,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', async () => {
      try {
        const res = await fetch('/api/projects?limit=100&sort=budgetPHP&order=desc');
        if (res.ok) {
          const pData = await res.json();
          const projects = pData.projects || [];

          for (const p of projects) {
            if (!p.gpsLat || !p.gpsLng) continue;

            const el = document.createElement('div');
            el.className = 'custom-marker';
            el.style.width = '14px';
            el.style.height = '14px';
            el.style.borderRadius = '50%';
            el.style.backgroundColor = p.flagOverdue || p.flagOverpaid ? '#ef4444' : p.isLive ? '#3b82f6' : '#10b981';
            el.style.border = '2px solid white';
            el.style.boxShadow = '0 0 6px rgba(0,0,0,0.5)';
            el.style.cursor = 'pointer';

            const popup = new mapboxgl.Popup({ offset: 15 }).setHTML(`
              <div style="font-family: sans-serif; padding: 4px; max-width: 220px;">
                <div style="font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase;">${p.province?.name || 'DPWH Project'}</div>
                <div style="font-size: 12px; font-weight: bold; margin-top: 2px; color: #111827;">${p.name.slice(0, 60)}...</div>
                <div style="font-size: 11px; margin-top: 4px; color: #374151;"><strong>Budget:</strong> ${formatCurrency(p.budgetPHP)}</div>
                <div style="font-size: 11px; color: #374151;"><strong>Progress:</strong> ${p.progress.toFixed(1)}%</div>
                <a href="/projects/${p.id}" style="display: inline-block; margin-top: 6px; font-size: 11px; color: #2563eb; font-weight: 600; text-decoration: none;">View Investigation &rarr;</a>
              </div>
            `);

            new mapboxgl.Marker(el)
              .setLngLat([p.gpsLng, p.gpsLat])
              .setPopup(popup)
              .addTo(map);
          }
        }
      } catch (err) {
        console.error('Error adding map markers:', err);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapMode]);

  // SVG Projection
  const projection = useMemo(() => {
    return geoMercator()
      .center([122.0, 12.8])
      .scale(2300 * zoomLevel)
      .translate([320, 360]);
  }, [zoomLevel]);

  const pathGenerator = useMemo(() => {
    return geoPath().projection(projection);
  }, [projection]);

  const activeStat = hoveredRegion ? statsMap.get(hoveredRegion) : null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm overflow-hidden mb-8">
      {/* Map Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>🗺️</span> National Infrastructure Transparency Map
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Interactive risk heat-map across 18 administrative regions. Hover or click to investigate.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setMapMode('choropleth')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                mapMode === 'choropleth'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🎨 Regional Risk
            </button>
            <button
              onClick={() => setMapMode('satellite')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                mapMode === 'satellite'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🛰️ Live Satellite
            </button>
          </div>

          {mapMode === 'choropleth' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoomLevel((z) => Math.min(z + 0.3, 2.5))}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition"
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(z - 0.3, 0.8))}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition"
                title="Zoom Out"
              >
                &minus;
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 shadow-sm transition"
                title="Reset Zoom"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Map View Display */}
      {mapMode === 'satellite' ? (
        <div className="relative h-[620px] w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner">
          <div ref={mapContainerRef} className="h-full w-full" />
          <div className="absolute bottom-4 left-4 rounded-lg bg-black/75 px-3 py-2 text-xs text-white backdrop-blur-md">
            <div className="font-semibold mb-1">Satellite Pin Legend:</div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> On-Track
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Overdue / Flagged
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Live Stream
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex flex-col lg:flex-row items-center justify-between gap-6 min-h-[620px]">
          {/* Interactive SVG Choropleth */}
          <div className="relative w-full lg:w-3/5 flex items-center justify-center bg-radial from-blue-50/50 to-transparent rounded-2xl p-4">
            {geoData ? (
              <svg
                viewBox="0 0 640 720"
                className="w-full max-w-[540px] h-auto drop-shadow-xl select-none"
              >
                <g>
                  {geoData.features.map((feature: any, idx: number) => {
                    const rawName = feature.properties?.REGION || feature.properties?.name || '';
                    const dbName = REGION_NAME_MAP[rawName] || rawName;
                    const stat = statsMap.get(dbName);
                    const density = stat?.anomalyDensity ?? 0;
                    const fillColor = getColor(density);
                    const isHovered = hoveredRegion === dbName;

                    const d = pathGenerator(feature);
                    if (!d) return null;

                    return (
                      <path
                        key={idx}
                        d={d}
                        fill={fillColor}
                        stroke={isHovered ? '#1e3a8a' : '#ffffff'}
                        strokeWidth={isHovered ? 2.5 : 1}
                        className="cursor-pointer transition-all duration-200"
                        style={{
                          filter: isHovered ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.35))' : undefined,
                          opacity: hoveredRegion && !isHovered ? 0.6 : 1,
                        }}
                        onMouseEnter={() => {
                          setHoveredRegion(dbName);
                        }}
                        onMouseLeave={() => {
                          setHoveredRegion(null);
                        }}
                        onClick={() => {
                          router.push(`/regions/${encodeURIComponent(dbName)}`);
                        }}
                      />
                    );
                  })}
                </g>
              </svg>
            ) : (
              <div className="flex h-[500px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            )}
          </div>

          {/* Region Inspection Side Panel */}
          <div className="w-full lg:w-2/5 space-y-4">
            {activeStat ? (
              <div className="rounded-2xl border-2 border-blue-500 bg-gradient-to-b from-blue-50/80 to-white p-6 shadow-md transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Selected Region</span>
                    <h3 className="text-xl font-extrabold text-gray-900 mt-0.5">{activeStat.name}</h3>
                  </div>
                  <div
                    className="h-4 w-4 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: getColor(activeStat.anomalyDensity) }}
                  />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white p-3.5 border border-gray-200 shadow-sm">
                    <span className="text-xs text-gray-500">Total Projects</span>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {activeStat.totalProjects.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3.5 border border-gray-200 shadow-sm">
                    <span className="text-xs text-gray-500">Flagged Anomalies</span>
                    <p className="text-lg font-bold text-red-600 mt-1">
                      {activeStat.flaggedProjects.toLocaleString()}
                    </p>
                  </div>
                  <div className="col-span-2 rounded-xl bg-white p-3.5 border border-gray-200 shadow-sm">
                    <span className="text-xs text-gray-500">Total Infrastructure Budget</span>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {formatCurrency(activeStat.totalBudget)}
                    </p>
                  </div>
                </div>

                {/* Risk Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1.5">
                    <span>Anomaly Risk Score</span>
                    <span style={{ color: getColor(activeStat.anomalyDensity) }}>
                      {(activeStat.anomalyDensity * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(activeStat.anomalyDensity * 100, 100)}%`,
                        backgroundColor: getColor(activeStat.anomalyDensity),
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => router.push(`/regions/${encodeURIComponent(activeStat.name)}`)}
                  className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-center text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
                >
                  Investigate {activeStat.name} &rarr;
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/70 p-8 text-center">
                <span className="text-3xl">👆</span>
                <h4 className="text-sm font-bold text-gray-800 mt-2">Hover or Click Any Region</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                  Explore anomaly risk distribution across Luzon, Visayas, and Mindanao.
                </p>
                <div className="mt-6 pt-6 border-t border-gray-200 text-left">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Top Anomalous Regions:</span>
                  <div className="mt-3 space-y-2">
                    {stats
                      .slice()
                      .sort((a, b) => b.anomalyDensity - a.anomalyDensity)
                      .slice(0, 4)
                      .map((r) => (
                        <button
                          key={r.name}
                          onClick={() => router.push(`/regions/${encodeURIComponent(r.name)}`)}
                          className="flex w-full items-center justify-between rounded-lg bg-white p-2.5 text-xs border border-gray-200 hover:border-blue-400 transition"
                        >
                          <span className="font-semibold text-gray-900">{r.name}</span>
                          <span className="font-bold" style={{ color: getColor(r.anomalyDensity) }}>
                            {(r.anomalyDensity * 100).toFixed(1)}%
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend Footer */}
      <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-500">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-gray-700">Anomaly Risk Scale:</span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-[#22c55e]" /> &lt;5% (Low)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-[#84cc16]" /> 5-15% (Moderate)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-[#eab308]" /> 15-30% (Elevated)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-[#ea580c]" /> 30-50% (High)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-[#dc2626]" /> &gt;50% (Critical)
          </span>
        </div>
        <span className="text-gray-400">
          Source: Live DPWH Transparency Infrastructure Registry
        </span>
      </div>
    </div>
  );
}
