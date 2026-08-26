'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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

const BASEMAP_STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
  streets: 'mapbox://styles/mapbox/outdoors-v12',
};

export default function PhilippinesMap({ stats, getColor }: PhilippinesMapProps) {
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [geoData, setGeoData] = useState<any>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionStat | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<RegionStat | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [basemap, setBasemap] = useState<'satellite' | 'dark' | 'streets'>('satellite');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.4);
  const [showPins, setShowPins] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const hoveredStateIdRef = useRef<number | string | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

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

  // Compute GeoJSON with enriched properties & IDs
  const enrichedGeoJson = useMemo(() => {
    if (!geoData) return null;

    const features = geoData.features.map((feature: any, index: number) => {
      const rawName = feature.properties?.REGION || feature.properties?.name || '';
      const dbName = REGION_NAME_MAP[rawName] || rawName;
      const stat = statsMap.get(dbName);
      const density = stat?.anomalyDensity ?? 0;
      const fillColor = getColor(density);

      return {
        ...feature,
        id: index,
        properties: {
          ...feature.properties,
          featureId: index,
          dbName,
          totalProjects: stat?.totalProjects ?? 0,
          flaggedProjects: stat?.flaggedProjects ?? 0,
          totalBudget: stat?.totalBudget ?? 0,
          anomalyDensity: density,
          fillColor,
        },
      };
    });

    return {
      ...geoData,
      features,
    };
  }, [geoData, statsMap, getColor]);

  // Initialize Mapbox Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: BASEMAP_STYLES[basemap],
      center: [122.0, 12.8],
      zoom: 5.5,
      pitch: 20,
      bearing: 0,
      maxZoom: 18,
      minZoom: 4.5,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    map.on('load', () => {
      setIsLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setIsLoaded(false);
    };
  }, [basemap]);

  // Add / Update GeoJSON layers on Mapbox
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded || !enrichedGeoJson) return;

    // Remove existing if present
    if (map.getLayer('ph-regions-labels')) map.removeLayer('ph-regions-labels');
    if (map.getLayer('ph-regions-line')) map.removeLayer('ph-regions-line');
    if (map.getLayer('ph-regions-fill')) map.removeLayer('ph-regions-fill');
    if (map.getSource('ph-regions')) map.removeSource('ph-regions');

    map.addSource('ph-regions', {
      type: 'geojson',
      data: enrichedGeoJson,
      generateId: true,
    });

    // 1. Semi-transparent Colored Fill Layer
    map.addLayer({
      id: 'ph-regions-fill',
      type: 'fill',
      source: 'ph-regions',
      paint: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          Math.min(overlayOpacity + 0.3, 0.85),
          overlayOpacity,
        ],
      },
    });

    // 2. Glowing White/Blue Boundary Outlines
    map.addLayer({
      id: 'ph-regions-line',
      type: 'line',
      source: 'ph-regions',
      paint: {
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          '#60a5fa',
          '#ffffff',
        ],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          3,
          1.2,
        ],
        'line-opacity': 0.9,
      },
    });

    // 3. Region Labels Layer
    map.addLayer({
      id: 'ph-regions-labels',
      type: 'symbol',
      source: 'ph-regions',
      layout: {
        'text-field': ['get', 'dbName'],
        'text-size': 11,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.05,
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 2,
        'text-halo-blur': 1,
      },
    });

    // Mouse Move & Hover
    const onMouseMove = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        map.getCanvas().style.cursor = 'pointer';

        if (hoveredStateIdRef.current !== null) {
          map.setFeatureState(
            { source: 'ph-regions', id: hoveredStateIdRef.current },
            { hover: false }
          );
        }

        hoveredStateIdRef.current = feature.id ?? null;
        if (hoveredStateIdRef.current !== null) {
          map.setFeatureState(
            { source: 'ph-regions', id: hoveredStateIdRef.current },
            { hover: true }
          );
        }

        const dbName = feature.properties?.dbName;
        const stat = statsMap.get(dbName);
        if (stat) {
          setHoveredRegion(stat);
          setCursorPos({ x: e.point.x, y: e.point.y });
        }
      }
    };

    const onMouseLeave = () => {
      map.getCanvas().style.cursor = '';
      if (hoveredStateIdRef.current !== null) {
        map.setFeatureState(
          { source: 'ph-regions', id: hoveredStateIdRef.current },
          { hover: false }
        );
      }
      hoveredStateIdRef.current = null;
      setHoveredRegion(null);
      setCursorPos(null);
    };

    const onClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const dbName = feature.properties?.dbName;
        const stat = statsMap.get(dbName);
        if (stat) {
          setSelectedRegion(stat);

          // Calculate bounding box for smooth zoom
          const coordinates = (feature.geometry as any).coordinates;
          const bounds = new mapboxgl.LngLatBounds();
          const processCoords = (coords: any) => {
            if (typeof coords[0] === 'number') {
              bounds.extend(coords as [number, number]);
            } else {
              coords.forEach(processCoords);
            }
          };
          processCoords(coordinates);

          if (!bounds.isEmpty()) {
            map.fitBounds(bounds, { padding: 60, duration: 1400 });
          }
        }
      }
    };

    map.on('mousemove', 'ph-regions-fill', onMouseMove);
    map.on('mouseleave', 'ph-regions-fill', onMouseLeave);
    map.on('click', 'ph-regions-fill', onClick);

    return () => {
      map.off('mousemove', 'ph-regions-fill', onMouseMove);
      map.off('mouseleave', 'ph-regions-fill', onMouseLeave);
      map.off('click', 'ph-regions-fill', onClick);
    };
  }, [isLoaded, enrichedGeoJson, overlayOpacity, statsMap]);

  // Load Project Pins onto Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!showPins) return;

    fetch('/api/projects?limit=150&sort=budgetPHP&order=desc')
      .then((res) => (res.ok ? res.json() : null))
      .then((pData) => {
        if (!pData?.projects) return;

        for (const p of pData.projects) {
          if (!p.gpsLat || !p.gpsLng) continue;

          const el = document.createElement('div');
          el.className = 'marker-pin group';
          el.style.width = '12px';
          el.style.height = '12px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor =
            p.flagOverdue || p.flagOverpaid
              ? '#ef4444'
              : p.isLive
              ? '#3b82f6'
              : '#10b981';
          el.style.border = '2px solid white';
          el.style.boxShadow = '0 0 8px rgba(0,0,0,0.6)';
          el.style.cursor = 'pointer';

          const popup = new mapboxgl.Popup({ offset: 12, closeButton: false }).setHTML(`
            <div style="font-family: sans-serif; padding: 6px; max-width: 230px;">
              <div style="font-size: 9px; font-weight: 800; color: #6b7280; text-transform: uppercase;">${p.province?.name || 'DPWH Project'}</div>
              <div style="font-size: 11px; font-weight: bold; margin-top: 2px; color: #111827; line-height: 1.3;">${p.name.slice(0, 70)}...</div>
              <div style="font-size: 11px; margin-top: 4px; color: #374151;"><strong>Budget:</strong> ${formatCurrency(p.budgetPHP)}</div>
              <div style="font-size: 11px; color: #374151;"><strong>Progress:</strong> ${p.progress.toFixed(1)}%</div>
              <a href="/projects/${p.id}" style="display: inline-block; margin-top: 6px; font-size: 11px; color: #2563eb; font-weight: 700; text-decoration: none;">Investigate Contract &rarr;</a>
            </div>
          `);

          const marker = new mapboxgl.Marker(el)
            .setLngLat([p.gpsLng, p.gpsLat])
            .setPopup(popup)
            .addTo(map);

          markersRef.current.push(marker);
        }
      })
      .catch((err) => console.error('Error adding pins:', err));
  }, [isLoaded, showPins]);

  const resetView = () => {
    setSelectedRegion(null);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [122.0, 12.8],
        zoom: 5.5,
        pitch: 20,
        bearing: 0,
        duration: 1400,
      });
    }
  };

  return (
    <div className="relative rounded-2xl border border-gray-200 bg-gray-900 text-white shadow-xl overflow-hidden mb-8">
      {/* Top Glass Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/60 p-3 backdrop-blur-md border border-white/10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">
                National Satellite Transparency Lens
              </h2>
              <p className="text-[11px] text-gray-300">
                Interactive regional anomaly overlays on high-res satellite earth.
              </p>
            </div>
          </div>
        </div>

        {/* HUD Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Basemap Switcher */}
          <div className="flex items-center rounded-lg bg-white/10 p-1 border border-white/10">
            <button
              onClick={() => setBasemap('satellite')}
              className={`rounded px-2.5 py-1 font-semibold transition ${
                basemap === 'satellite' ? 'bg-blue-600 text-white shadow' : 'text-gray-300 hover:text-white'
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => setBasemap('dark')}
              className={`rounded px-2.5 py-1 font-semibold transition ${
                basemap === 'dark' ? 'bg-blue-600 text-white shadow' : 'text-gray-300 hover:text-white'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setBasemap('streets')}
              className={`rounded px-2.5 py-1 font-semibold transition ${
                basemap === 'streets' ? 'bg-blue-600 text-white shadow' : 'text-gray-300 hover:text-white'
              }`}
            >
              Terrain
            </button>
          </div>

          {/* Opacity Slider */}
          <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 border border-white/10">
            <span className="text-gray-300">Overlay:</span>
            <input
              type="range"
              min="0"
              max="0.85"
              step="0.05"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
              className="w-20 cursor-pointer accent-blue-500"
            />
            <span className="font-mono text-[11px] text-gray-200">
              {Math.round(overlayOpacity * 100)}%
            </span>
          </div>

          {/* Pins Toggle */}
          <button
            onClick={() => setShowPins(!showPins)}
            className={`rounded-lg px-2.5 py-1.5 font-semibold border transition ${
              showPins
                ? 'bg-emerald-600/80 border-emerald-500 text-white'
                : 'bg-white/10 border-white/10 text-gray-300'
            }`}
          >
            {showPins ? 'Pins ON' : 'Pins OFF'}
          </button>

          {/* Reset Zoom */}
          <button
            onClick={resetView}
            className="rounded-lg bg-white/15 px-3 py-1.5 font-semibold text-white hover:bg-white/25 border border-white/10 transition"
          >
            Reset View
          </button>
        </div>
      </div>

      {/* Mapbox Canvas */}
      <div className="relative h-[680px] w-full">
        <div ref={mapContainerRef} className="h-full w-full" />

        {/* Floating Tooltip following Cursor */}
        {hoveredRegion && cursorPos && (
          <div
            className="pointer-events-none absolute z-20 rounded-xl bg-black/80 p-3.5 text-white backdrop-blur-md border border-white/15 shadow-2xl transition-all duration-75"
            style={{
              left: `${cursorPos.x + 15}px`,
              top: `${cursorPos.y + 15}px`,
              maxWidth: '260px',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-bold text-sm text-white">{hoveredRegion.name}</h4>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: getColor(hoveredRegion.anomalyDensity) }}
              />
            </div>
            <div className="mt-2 space-y-1 text-xs text-gray-300">
              <div className="flex justify-between">
                <span>Projects:</span>
                <span className="font-bold text-white">{hoveredRegion.totalProjects.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Flagged:</span>
                <span className="font-bold text-red-400">{hoveredRegion.flaggedProjects.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Budget:</span>
                <span className="font-bold text-white">{formatCurrency(hoveredRegion.totalBudget)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-white/10">
                <span>Anomaly Risk:</span>
                <span className="font-extrabold" style={{ color: getColor(hoveredRegion.anomalyDensity) }}>
                  {(hoveredRegion.anomalyDensity * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-blue-400 font-semibold">Click to zoom & explore &rarr;</p>
          </div>
        )}

        {/* Side Detail Card for Selected Region */}
        {selectedRegion && (
          <div className="absolute bottom-6 left-6 z-10 w-80 rounded-2xl bg-black/85 p-5 text-white backdrop-blur-xl border border-white/20 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Selected Region</span>
                <h3 className="text-lg font-black text-white mt-0.5">{selectedRegion.name}</h3>
              </div>
              <button
                onClick={() => setSelectedRegion(null)}
                className="rounded-full bg-white/10 p-1 text-gray-400 hover:text-white hover:bg-white/20 transition"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white/10 p-2.5 border border-white/5">
                <span className="text-gray-400 text-[10px]">Total Contracts</span>
                <p className="text-base font-bold text-white mt-0.5">
                  {selectedRegion.totalProjects.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-white/10 p-2.5 border border-white/5">
                <span className="text-gray-400 text-[10px]">Flagged Anomalies</span>
                <p className="text-base font-bold text-red-400 mt-0.5">
                  {selectedRegion.flaggedProjects.toLocaleString()}
                </p>
              </div>
              <div className="col-span-2 rounded-xl bg-white/10 p-2.5 border border-white/5">
                <span className="text-gray-400 text-[10px]">Total Public Expenditure</span>
                <p className="text-base font-bold text-emerald-400 mt-0.5">
                  {formatCurrency(selectedRegion.totalBudget)}
                </p>
              </div>
            </div>

            {/* Risk Indicator */}
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Regional Risk Score:</span>
                <span className="font-bold" style={{ color: getColor(selectedRegion.anomalyDensity) }}>
                  {(selectedRegion.anomalyDensity * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(selectedRegion.anomalyDensity * 100, 100)}%`,
                    backgroundColor: getColor(selectedRegion.anomalyDensity),
                  }}
                />
              </div>
            </div>

            <button
              onClick={() => router.push(`/regions/${encodeURIComponent(selectedRegion.name)}`)}
              className="mt-4 w-full rounded-xl bg-blue-600 py-2.5 text-center text-xs font-bold text-white shadow-lg hover:bg-blue-700 transition"
            >
              Open Full {selectedRegion.name} Audit &rarr;
            </button>
          </div>
        )}

        {/* Legend Overlay at Bottom Right */}
        <div className="absolute bottom-6 right-6 z-10 rounded-xl bg-black/75 p-3.5 text-xs text-white backdrop-blur-md border border-white/10 shadow-lg">
          <div className="font-bold text-[11px] uppercase tracking-wide text-gray-300 mb-2">
            Anomaly Risk Scale
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-[#22c55e]" /> &lt;5% (Low)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-[#84cc16]" /> 5-15% (Mod)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-[#eab308]" /> 15-30% (Elev)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-[#ea580c]" /> 30-50% (High)
            </div>
            <div className="col-span-2 flex items-center gap-1.5 pt-1 border-t border-white/10">
              <span className="h-2.5 w-2.5 rounded bg-[#dc2626]" /> &gt;50% (Critical)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
