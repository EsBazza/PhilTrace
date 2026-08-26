'use client';

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { formatCurrency } from '@/lib/format';
import ProjectInspectionDrawer from '@/components/project-inspection-drawer';

interface LocationHierarchy {
  regions: Array<{
    id: string;
    name: string;
    psgcCode: string;
    provinces: Array<{
      id: string;
      name: string;
      psgcCode: string;
    }>;
  }>;
}

const PHILIPPINES_BOUNDS: [[number, number], [number, number]] = [
  [114.0, 4.0],
  [128.5, 22.0],
];

const BASEMAP_STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
  streets: 'mapbox://styles/mapbox/outdoors-v12',
};

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

const PROVINCE_CENTERS: Record<string, [number, number]> = {
  'Ilocos Norte': [120.70, 18.19],
  'Ilocos Sur': [120.55, 17.30],
  'La Union': [120.38, 16.62],
  'Pangasinan': [120.33, 15.92],
  'Pampanga': [120.68, 15.05],
  'Bataan': [120.48, 14.68],
  'Bulacan': [120.97, 14.95],
  'Tarlac': [120.58, 15.48],
  'Zambales': [120.10, 15.30],
  'Nueva Ecija': [121.05, 15.58],
  'Aurora': [121.55, 15.75],
  'Benguet': [120.60, 16.42],
  'Cebu': [123.89, 10.31],
  'Davao del Sur': [125.35, 6.75],
  'Iloilo': [122.56, 10.72],
  'Cavite': [120.90, 14.28],
  'Rizal': [121.15, 14.60],
  'Laguna': [121.32, 14.20],
  'Batangas': [121.05, 13.80],
  'Quezon': [121.70, 14.00],
};

function stripDeoSuffix(deoName: string): string {
  let result = deoName.trim();
  result = result.replace(/ City DEO$/i, '');
  result = result.replace(/ \d+(?:st|nd|rd|th) DEO$/i, '');
  result = result.replace(/ DEO$/i, '');
  result = result.replace(/ Sub DEO$/i, '');
  return result.trim();
}

function isMatchingRegion(pinRegionName?: string, selectedRegionName?: string): boolean {
  if (!selectedRegionName) return true;
  if (!pinRegionName) return false;
  
  const normPin = (REGION_NAME_MAP[pinRegionName] || pinRegionName).toLowerCase().trim();
  const normSelected = (REGION_NAME_MAP[selectedRegionName] || selectedRegionName).toLowerCase().trim();
  
  return normPin === normSelected || normPin.includes(normSelected) || normSelected.includes(normPin);
}

function isMatchingProvince(pinProvinceName?: string, selectedProvinceName?: string): boolean {
  if (!selectedProvinceName) return true;
  if (!pinProvinceName) return false;

  const cleanPin = stripDeoSuffix(pinProvinceName).toLowerCase().trim();
  const cleanSelected = stripDeoSuffix(selectedProvinceName).toLowerCase().trim();

  if (cleanPin === cleanSelected) return true;
  if (cleanPin.startsWith(cleanSelected) || cleanSelected.startsWith(cleanPin)) return true;
  if (cleanPin.includes(cleanSelected) || cleanSelected.includes(cleanPin)) return true;
  return false;
}

function MapContent() {
  const searchParams = useSearchParams();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);

  // Modes & UI State
  const [mapMode, setMapMode] = useState<'free_roam' | 'drill_down'>('drill_down');
  const [basemap, setBasemap] = useState<'satellite' | 'dark' | 'streets'>('satellite');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [regionGeoJson, setRegionGeoJson] = useState<any>(null);

  // Drill-down State
  const [hierarchy, setHierarchy] = useState<LocationHierarchy | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterAnomaly, setFilterAnomaly] = useState<string>('All');

  // Load URL search parameters if available
  useEffect(() => {
    const r = searchParams.get('region');
    const p = searchParams.get('province');
    const projId = searchParams.get('project') || searchParams.get('projectId');
    if (r) {
      setSelectedRegion(r);
      setMapMode('drill_down');
    }
    if (p) setSelectedProvince(p);
    if (projId) {
      setSelectedProjectId(projId);
    }
  }, [searchParams]);

  // Fly map camera directly to project coordinates when selectedProjectId changes
  useEffect(() => {
    if (!selectedProjectId || !isMapLoaded || !mapRef.current) return;

    fetch(`/api/projects/${selectedProjectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const p = data?.project || data;
        if (p?.gpsLat && p?.gpsLng && mapRef.current) {
          mapRef.current.flyTo({
            center: [p.gpsLng, p.gpsLat],
            zoom: 14.5,
            pitch: 30,
            duration: 1600,
          });
        }
      })
      .catch(console.error);
  }, [selectedProjectId, isMapLoaded]);

  // Load Hierarchy
  useEffect(() => {
    fetch('/api/locations/hierarchy')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d) setHierarchy(d);
      })
      .catch(console.error);
  }, []);

  // Load PH Region GeoJSON
  useEffect(() => {
    fetch('/data/ph-regions.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setRegionGeoJson(data);
      })
      .catch(console.error);
  }, []);

  // Initialize Mapbox Engine
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: BASEMAP_STYLES[basemap],
      center: [122.0, 12.8],
      zoom: 5.8,
      minZoom: 4.8,
      maxZoom: 18,
      maxBounds: PHILIPPINES_BOUNDS,
      pitch: 20,
      bearing: 0,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(new mapboxgl.GeolocateControl({ trackUserLocation: true }), 'bottom-right');

    map.on('load', () => {
      setIsMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setIsMapLoaded(false);
    };
  }, [basemap]);

  // Render Region Outline Layer ONLY (Only selected region gets an outline; unselected get 0 outline)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || !regionGeoJson) return;

    if (map.getLayer('ph-region-outline-layer')) map.removeLayer('ph-region-outline-layer');
    if (map.getLayer('ph-region-fill-layer')) map.removeLayer('ph-region-fill-layer');
    if (map.getSource('ph-region-source')) map.removeSource('ph-region-source');

    const enrichedFeatures = regionGeoJson.features.map((feature: any) => {
      const rawName = feature.properties?.REGION || feature.properties?.name || '';
      const dbName = REGION_NAME_MAP[rawName] || rawName;
      const isSelected = selectedRegion && isMatchingRegion(dbName, selectedRegion);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          dbName,
          isSelected,
        },
      };
    });

    map.addSource('ph-region-source', {
      type: 'geojson',
      data: {
        ...regionGeoJson,
        features: enrichedFeatures,
      },
    });

    // Translucent Region Fill Layer (ONLY selected region is highlighted)
    map.addLayer({
      id: 'ph-region-fill-layer',
      type: 'fill',
      source: 'ph-region-source',
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['get', 'isSelected'], false],
          '#0284c7',
          selectedRegion ? '#000000' : 'transparent',
        ],
        'fill-opacity': [
          'case',
          ['boolean', ['get', 'isSelected'], false],
          0.15,
          selectedRegion ? 0.45 : 0,
        ],
      },
    });

    // Glowing Neon Region Outline Layer (ONLY the selected region gets an outline!)
    map.addLayer({
      id: 'ph-region-outline-layer',
      type: 'line',
      source: 'ph-region-source',
      paint: {
        'line-color': '#38bdf8',
        'line-width': selectedRegion
          ? [
              'case',
              ['boolean', ['get', 'isSelected'], false],
              3.5,
              0,
            ]
          : 1,
        'line-opacity': selectedRegion
          ? [
              'case',
              ['boolean', ['get', 'isSelected'], false],
              1.0,
              0.0,
            ]
          : 0.5,
      },
    });
  }, [isMapLoaded, regionGeoJson, selectedRegion]);

  // Load & Render Dynamic Project Pins (ONLY show projects belonging strictly to selected Region / City)
  const renderMapLayers = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    try {
      const params = new URLSearchParams();
      params.set('limit', '500');
      if (selectedRegion) params.set('region', selectedRegion);
      if (selectedProvince) params.set('province', selectedProvince);
      if (filterCategory !== 'All') params.set('category', filterCategory);
      if (filterAnomaly !== 'All') params.set('flag', filterAnomaly);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(`/api/projects?${params.toString()}`);
      if (!res.ok) return;

      const data = await res.json();
      const allProjects = data.projects || [];

      // Filter projects strictly based on user selection: ONLY show pins for selected Region / City
      const visibleProjects = allProjects.filter((p: any) => {
        if (!p.gpsLat || !p.gpsLng) return false;
        const pinRegion = p.province?.region?.name || '';
        const pinProvince = p.province?.name || '';

        if (selectedProvince) {
          return isMatchingProvince(pinProvince, selectedProvince);
        }
        if (selectedRegion) {
          return isMatchingRegion(pinRegion, selectedRegion);
        }
        return true;
      });

      // Clear existing markers & popups cleanly
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      popupsRef.current.forEach((p) => p.remove());
      popupsRef.current = [];

      const visibleCoords: [number, number][] = [];

      // Render ONLY matching project pins with 100% fixed pixel positioning
      for (const p of visibleProjects) {
        visibleCoords.push([p.gpsLng, p.gpsLat]);

        const statusColor =
          p.flagOverdue || p.flagOverpaid
            ? '#ef4444'
            : p.isLive
            ? '#3b82f6'
            : '#10b981';

        // Marker DOM Element (fixed 14x14 circular pin, locked at exact lat/lng without scale transform jitter)
        const el = document.createElement('div');
        el.style.width = '14px';
        el.style.height = '14px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = statusColor;
        el.style.border = '2px solid #ffffff';
        el.style.boxShadow = `0 0 12px ${statusColor}, 0 2px 8px rgba(0,0,0,0.8)`;
        el.style.cursor = 'pointer';
        el.style.transition = 'box-shadow 0.15s ease-in-out';

        // Non-blocking Mapbox Popup (pointer-events: none prevents mouseleave flicker loops)
        const popup = new mapboxgl.Popup({
          offset: [0, -10],
          closeButton: false,
          closeOnClick: false,
          anchor: 'bottom',
          className: 'pointer-events-none z-50',
        }).setHTML(`
          <div style="background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); color: #ffffff; font-family: system-ui, sans-serif; min-width: 220px; max-width: 260px; pointer-events: none;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
              <span style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">${p.province?.name || 'DPWH Project'}</span>
              <span style="font-size: 9px; font-weight: 700; color: ${p.status === 'Completed' ? '#34d399' : '#fbbf24'}; background: rgba(255,255,255,0.1); padding: 1px 6px; border-radius: 9999px;">${p.status}</span>
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #ffffff; line-height: 1.35; margin-top: 4px;">${p.name.slice(0, 70)}...</div>
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
              <span style="color: #94a3b8;">Budget:</span>
              <span style="font-weight: 800; color: #38bdf8;">${formatCurrency(p.budgetPHP)}</span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; margin-top: 2px;">
              <span style="color: #94a3b8;">Progress:</span>
              <span style="font-weight: 700; color: #60a5fa;">${p.progress.toFixed(1)}%</span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; margin-top: 6px; color: #fbbf24; font-weight: 700;">
              <span>⭐ ${p.avgRating > 0 ? p.avgRating.toFixed(1) : 'No reviews'}</span>
              <span style="color: #38bdf8; font-weight: 800;">Click to Inspect &rarr;</span>
            </div>
          </div>
        `);

        el.addEventListener('mouseenter', () => {
          el.style.boxShadow = `0 0 20px ${statusColor}, 0 0 28px ${statusColor}`;
          popup.addTo(map);
        });

        el.addEventListener('mouseleave', () => {
          el.style.boxShadow = `0 0 12px ${statusColor}, 0 2px 8px rgba(0,0,0,0.8)`;
          popup.remove();
        });

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedProjectId(p.id);
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([p.gpsLng, p.gpsLat])
          .addTo(map);

        markersRef.current.push(marker);
        popupsRef.current.push(popup);
      }

      // Smooth camera fit when province/city is selected
      if (selectedProvince && visibleCoords.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        visibleCoords.forEach((pt) => bounds.extend(pt));
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 90, duration: 1300 });
        }
      }
    } catch (err) {
      console.error('Error rendering map layers:', err);
    }
  }, [isMapLoaded, selectedRegion, selectedProvince, filterCategory, filterAnomaly, searchQuery]);

  useEffect(() => {
    renderMapLayers();
  }, [renderMapLayers]);

  // Handle Region Selection
  const handleSelectRegion = (regionName: string) => {
    setSelectedRegion(regionName);
    setSelectedProvince('');

    if (!regionName) {
      mapRef.current?.flyTo({
        center: [122.0, 12.8],
        zoom: 5.8,
        duration: 1500,
      });
      return;
    }

    const regionCenters: Record<string, [number, number]> = {
      'National Capital Region': [121.0, 14.6],
      'Region I': [120.4, 16.5],
      'Region II': [121.8, 17.0],
      'Region III': [120.6, 15.2],
      'Region IV-A': [121.2, 14.1],
      'Region IV-B': [119.0, 10.0],
      'Region V': [123.4, 13.5],
      'Region VI': [122.5, 11.0],
      'Region VII': [123.9, 10.3],
      'Region VIII': [125.0, 11.2],
      'Region IX': [122.5, 8.0],
      'Region X': [124.6, 8.5],
      'Region XI': [125.6, 7.2],
      'Region XII': [124.8, 6.5],
      'Region XIII': [125.5, 9.0],
      'BARMM': [124.3, 7.2],
      'Cordillera Administrative Region': [121.0, 17.3],
      'Negros Island Region': [123.0, 10.0],
    };

    const target = regionCenters[regionName] || [122.0, 12.8];
    mapRef.current?.flyTo({
      center: target,
      zoom: 8.2,
      duration: 1500,
    });
  };

  // Handle Province Drill-Down selection (e.g. Pampanga, Ilocos Norte)
  const handleSelectProvince = (provinceName: string) => {
    setSelectedProvince(provinceName);
    if (!provinceName) return;

    const targetCenter = PROVINCE_CENTERS[provinceName];
    if (targetCenter && mapRef.current) {
      mapRef.current.flyTo({
        center: targetCenter,
        zoom: 10.4,
        duration: 1300,
      });
    }
  };

  const activeProvinces = useMemo(() => {
    if (!hierarchy || !selectedRegion) return [];
    const reg = hierarchy.regions.find((r) => r.name === selectedRegion);
    return reg?.provinces || [];
  }, [hierarchy, selectedRegion]);

  return (
    <div className="relative h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-950 select-none">
      {/* Top Floating Google Maps-Style Control Hub */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: Mode Switcher & Drill-Down Breadcrumbs */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Mode Switcher */}
          <div className="flex items-center rounded-xl bg-black/80 p-1 backdrop-blur-md border border-white/15 shadow-xl text-xs font-bold text-white">
            <button
              onClick={() => {
                setMapMode('free_roam');
                setSelectedRegion('');
                setSelectedProvince('');
              }}
              className={`rounded-lg px-3 py-1.5 transition ${
                mapMode === 'free_roam' ? 'bg-blue-600 text-white shadow' : 'text-gray-300 hover:text-white'
              }`}
            >
              🌐 Free Roam
            </button>
            <button
              onClick={() => setMapMode('drill_down')}
              className={`rounded-lg px-3 py-1.5 transition ${
                mapMode === 'drill_down' ? 'bg-blue-600 text-white shadow' : 'text-gray-300 hover:text-white'
              }`}
            >
              🎯 Guided Drill-Down
            </button>
          </div>

          {/* Guided Mode Breadcrumbs */}
          {mapMode === 'drill_down' && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-black/80 px-3 py-1.5 backdrop-blur-md border border-white/15 shadow-xl text-xs text-white">
              <span className="text-blue-400 font-bold">🇵🇭 Philippines</span>
              <span>&gt;</span>

              {/* Region Dropdown */}
              <select
                value={selectedRegion}
                onChange={(e) => handleSelectRegion(e.target.value)}
                className="rounded-md bg-white/10 px-2 py-1 text-xs text-white font-semibold border border-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="" className="bg-gray-900 text-white">All 18 Regions</option>
                {hierarchy?.regions.map((r) => (
                  <option key={r.id} value={r.name} className="bg-gray-900 text-white">
                    {r.name}
                  </option>
                ))}
              </select>

              {selectedRegion && (
                <>
                  <span>&gt;</span>
                  {/* Province/City Dropdown */}
                  <select
                    value={selectedProvince}
                    onChange={(e) => handleSelectProvince(e.target.value)}
                    className="rounded-md bg-white/10 px-2 py-1 text-xs text-white font-semibold border border-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="" className="bg-gray-900 text-white">All Cities/Provinces in {selectedRegion}</option>
                    {activeProvinces.map((p) => (
                      <option key={p.id} value={p.name} className="bg-gray-900 text-white">
                        {p.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}

          {/* Active Highlight Banner */}
          {(selectedRegion || selectedProvince) && (
            <div className="flex items-center gap-2 rounded-xl bg-blue-600/90 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-md border border-blue-400/30">
              <span className="h-2 w-2 rounded-full bg-cyan-300 animate-ping" />
              <span>
                Focused: {selectedProvince ? `${selectedProvince}, ${selectedRegion}` : selectedRegion}
              </span>
              <button
                onClick={() => {
                  setSelectedRegion('');
                  setSelectedProvince('');
                }}
                className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 hover:bg-white/40"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Right: Basemap Switcher & Anomaly Filter */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Quick Anomaly Filter */}
          <select
            value={filterAnomaly}
            onChange={(e) => setFilterAnomaly(e.target.value)}
            className="rounded-xl bg-black/80 px-3 py-1.5 backdrop-blur-md border border-white/15 shadow-xl text-xs font-semibold text-white focus:outline-none"
          >
            <option value="All">All Projects</option>
            <option value="overdue">⚠️ Overdue Only</option>
            <option value="overpaid">🚨 Overpaid Only</option>
            <option value="neverStarted">⏳ Never Started</option>
          </select>

          {/* Basemap Switcher */}
          <div className="flex items-center rounded-xl bg-black/80 p-1 backdrop-blur-md border border-white/15 shadow-xl text-xs font-semibold text-white">
            <button
              onClick={() => setBasemap('satellite')}
              className={`rounded-lg px-2.5 py-1 transition ${
                basemap === 'satellite' ? 'bg-blue-600 text-white' : 'text-gray-300'
              }`}
            >
              🛰️ Satellite
            </button>
            <button
              onClick={() => setBasemap('dark')}
              className={`rounded-lg px-2.5 py-1 transition ${
                basemap === 'dark' ? 'bg-blue-600 text-white' : 'text-gray-300'
              }`}
            >
              🌑 Dark
            </button>
            <button
              onClick={() => setBasemap('streets')}
              className={`rounded-lg px-2.5 py-1 transition ${
                basemap === 'streets' ? 'bg-blue-600 text-white' : 'text-gray-300'
              }`}
            >
              🗺️ Terrain
            </button>
          </div>
        </div>
      </div>

      {/* Mapbox Canvas */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Slide-out Google Maps-style Inspection Drawer */}
      <ProjectInspectionDrawer
        projectId={selectedProjectId}
        onClose={() => setSelectedProjectId(null)}
      />
    </div>
  );
}

export default function FullscreenMapPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-slate-950 flex items-center justify-center text-white">Loading PhilTrace Map Engine...</div>}>
      <MapContent />
    </Suspense>
  );
}
