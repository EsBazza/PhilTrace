'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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

export default function FullscreenMapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);

  // Modes & UI State
  const [mapMode, setMapMode] = useState<'free_roam' | 'drill_down'>('free_roam');
  const [basemap, setBasemap] = useState<'satellite' | 'dark' | 'streets'>('satellite');
  const [heatmapMetric, setHeatmapMetric] = useState<'count' | 'budget'>('budget');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Drill-down State
  const [hierarchy, setHierarchy] = useState<LocationHierarchy | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterAnomaly, setFilterAnomaly] = useState<string>('All');

  // Load Hierarchy
  useEffect(() => {
    fetch('/api/locations/hierarchy')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d) setHierarchy(d);
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

  // Load & Render Dynamic Project Pins and Hover Previews
  const renderMapLayers = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    try {
      // Build API query
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (selectedRegion) params.set('region', selectedRegion);
      if (selectedProvince) params.set('province', selectedProvince);
      if (filterCategory !== 'All') params.set('category', filterCategory);
      if (filterAnomaly !== 'All') params.set('flag', filterAnomaly);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(`/api/projects?${params.toString()}`);
      if (!res.ok) return;

      const data = await res.json();
      const projects = data.projects || [];

      // Clear existing markers & popups
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      popupsRef.current.forEach((p) => p.remove());
      popupsRef.current = [];

      // Add individual interactive DOM Markers with working HOVER preview
      for (const p of projects) {
        if (!p.gpsLat || !p.gpsLng) continue;

        const el = document.createElement('div');
        el.className = 'project-pin';
        el.style.width = '16px';
        el.style.height = '16px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor =
          p.flagOverdue || p.flagOverpaid
            ? '#ef4444'
            : p.isLive
            ? '#3b82f6'
            : '#10b981';
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 0 10px rgba(0,0,0,0.65)';
        el.style.cursor = 'pointer';
        el.style.transition = 'transform 0.15s ease';

        // High-fidelity Google Maps-style Hover Tooltip
        const popup = new mapboxgl.Popup({
          offset: 16,
          closeButton: false,
          closeOnClick: false,
          className: 'project-preview-popup',
        }).setHTML(`
          <div style="font-family: system-ui, -apple-system, sans-serif; padding: 8px; max-width: 250px; background: #ffffff; border-radius: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 2px;">
              <span style="font-size: 9px; font-weight: 800; color: #4b5563; text-transform: uppercase;">${p.province?.name || 'DPWH Project'}</span>
              <span style="font-size: 9px; font-weight: 700; color: ${p.status === 'Completed' ? '#10b981' : '#f59e0b'}; background: #f3f4f6; padding: 1px 5px; border-radius: 4px;">${p.status}</span>
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #111827; line-height: 1.35; margin-top: 2px;">${p.name.slice(0, 75)}...</div>
            <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
              <span style="color: #6b7280;">Budget:</span>
              <span style="font-weight: 800; color: #111827;">${formatCurrency(p.budgetPHP)}</span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; margin-top: 2px;">
              <span style="color: #6b7280;">Progress:</span>
              <span style="font-weight: 700; color: #2563eb;">${p.progress.toFixed(1)}%</span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; margin-top: 4px; color: #d97706; font-weight: 700;">
              <span>⭐ ${p.avgRating > 0 ? p.avgRating.toFixed(1) : 'No reviews'}</span>
              <span style="color: #2563eb; font-weight: 800;">Click to Inspect &rarr;</span>
            </div>
          </div>
        `);

        // Hover Event Listeners
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.4)';
          popup.setLngLat([p.gpsLng, p.gpsLat]).addTo(map);
        });

        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
          popup.remove();
        });

        // Click opens Project Drawer
        el.addEventListener('click', () => {
          popup.remove();
          setSelectedProjectId(p.id);
        });

        const marker = new mapboxgl.Marker(el)
          .setLngLat([p.gpsLng, p.gpsLat])
          .addTo(map);

        markersRef.current.push(marker);
        popupsRef.current.push(popup);
      }
    } catch (err) {
      console.error('Error rendering map layers:', err);
    }
  }, [isMapLoaded, selectedRegion, selectedProvince, filterCategory, filterAnomaly, searchQuery]);

  useEffect(() => {
    renderMapLayers();
  }, [renderMapLayers]);

  // Handle Region Drill-Down selection
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
      'Region III': [120.6, 15.2],
      'Region IV-A': [121.2, 14.1],
      'Region I': [120.4, 16.5],
      'Region II': [121.8, 17.0],
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
      'Region IV-B': [119.0, 10.0],
      'Negros Island Region': [123.0, 10.0],
    };

    const target = regionCenters[regionName] || [122.0, 12.8];
    mapRef.current?.flyTo({
      center: target,
      zoom: 8.5,
      duration: 1500,
    });
  };

  // Handle Province Drill-Down selection
  const handleSelectProvince = (provinceName: string) => {
    setSelectedProvince(provinceName);
    if (!provinceName) return;

    mapRef.current?.easeTo({
      zoom: 10.5,
      duration: 1200,
    });
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
                  {/* Province Dropdown */}
                  <select
                    value={selectedProvince}
                    onChange={(e) => handleSelectProvince(e.target.value)}
                    className="rounded-md bg-white/10 px-2 py-1 text-xs text-white font-semibold border border-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="" className="bg-gray-900 text-white">All Provinces in {selectedRegion}</option>
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
