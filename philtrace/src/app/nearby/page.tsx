'use client';

import { useState, useEffect, useCallback, useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useNearbyProjects, type ProjectWithRelations } from '@/hooks/use-projects';
import { formatCurrency, formatDistance, cleanContractorName } from '@/lib/format';
import { STATUS_COLORS, FLAG_COLORS, PROJECT_CATEGORIES } from '@/lib/constants';

interface NearbyProject extends ProjectWithRelations {
  distance: number;
}

const RADIUS_OPTIONS = [1, 5, 10, 25];

const BASEMAP_STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
  streets: 'mapbox://styles/mapbox/outdoors-v12',
};

const PH_PRESETS = [
  { name: 'Manila (National Capital)', lat: 14.5995, lng: 120.9842 },
  { name: 'Quezon City', lat: 14.6488, lng: 121.0509 },
  { name: 'San Fernando (Pampanga)', lat: 15.0343, lng: 120.6844 },
  { name: 'Cebu City', lat: 10.3157, lng: 123.8854 },
  { name: 'Davao City', lat: 7.0731, lng: 125.6128 },
  { name: 'Baguio City', lat: 16.4124, lng: 120.5960 },
  { name: 'Iloilo City', lat: 10.6969, lng: 122.5644 },
  { name: 'Cagayan de Oro', lat: 8.4822, lng: 124.6472 },
];

function createGeoJSONCircle(center: [number, number], radiusKm: number, points = 64) {
  const [lng, lat] = center;
  const coords: [number, number][] = [];
  const distanceX = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusKm / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  coords.push(coords[0]);

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coords],
        },
        properties: {},
      },
    ],
  };
}

export default function NearbyPage() {
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radius, setRadius] = useState<number>(5);
  const [basemap, setBasemap] = useState<'satellite' | 'dark' | 'streets'>('satellite');
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);

  const [geoStatus, setGeoStatus] = useState<'idle' | 'prompt' | 'locating' | 'granted' | 'denied' | 'error' | 'unsupported'>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);

  // Manual input state
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLng, setManualLng] = useState<string>('');
  const [manualInputOpen, setManualInputOpen] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      setGeoError('Geolocation is not supported by your browser.');
      setManualInputOpen(true);
      return;
    }

    setGeoStatus('locating');
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        startTransition(() => {
          setLat(latitude);
          setLng(longitude);
          setManualLat(latitude.toFixed(5));
          setManualLng(longitude.toFixed(5));
          setGeoStatus('granted');
        });
      },
      (error) => {
        console.warn('Geolocation error:', error);
        setGeoStatus('denied');
        setGeoError('Location permission denied or unavailable. Choose a city preset below.');
        // Default fallback to Manila
        setLat(14.5995);
        setLng(120.9842);
        setManualLat('14.5995');
        setManualLng('120.9842');
        setManualInputOpen(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Fetch nearby projects via hook
  const { data, isLoading, error, refetch } = useNearbyProjects(lat, lng, radius);
  const rawProjects = (data?.projects as NearbyProject[]) || [];

  // Filter client-side
  const projects = rawProjects.filter((p) => {
    if (selectedCategory !== 'All' && !p.category.toLowerCase().includes(selectedCategory.toLowerCase())) {
      return false;
    }
    if (selectedStatus !== 'All' && p.status !== selectedStatus) {
      return false;
    }
    return true;
  });

  // Initialize Mapbox Engine
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: BASEMAP_STYLES[basemap],
      center: [lng ?? 120.9842, lat ?? 14.5995],
      zoom: radius <= 2 ? 13 : radius <= 5 ? 12 : radius <= 10 ? 10.8 : 9.5,
      pitch: 20,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-left');

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

  // Update User Marker & Radius Circle Layer on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || lat === null || lng === null) return;

    // Center Map Camera over user location
    map.flyTo({
      center: [lng, lat],
      zoom: radius <= 2 ? 13.5 : radius <= 5 ? 12.2 : radius <= 10 ? 11 : 9.8,
      duration: 1200,
    });

    // Update User Location Pulse Marker
    if (userMarkerRef.current) userMarkerRef.current.remove();

    const userEl = document.createElement('div');
    userEl.className = 'relative flex items-center justify-center';
    userEl.innerHTML = `
      <div className="absolute h-8 w-8 rounded-full bg-blue-500/40 animate-ping"></div>
      <div style="width: 18px; height: 18px; background: #2563eb; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 16px #2563eb;"></div>
    `;

    userMarkerRef.current = new mapboxgl.Marker({ element: userEl, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(map);

    // Update Radius Circle GeoJSON Layer
    if (map.getLayer('radius-circle-line')) map.removeLayer('radius-circle-line');
    if (map.getLayer('radius-circle-fill')) map.removeLayer('radius-circle-fill');
    if (map.getSource('radius-circle-source')) map.removeSource('radius-circle-source');

    const circleGeoJson = createGeoJSONCircle([lng, lat], radius);

    map.addSource('radius-circle-source', {
      type: 'geojson',
      data: circleGeoJson as any,
    });

    map.addLayer({
      id: 'radius-circle-fill',
      type: 'fill',
      source: 'radius-circle-source',
      paint: {
        'fill-color': '#0284c7',
        'fill-opacity': 0.12,
      },
    });

    map.addLayer({
      id: 'radius-circle-line',
      type: 'line',
      source: 'radius-circle-source',
      paint: {
        'line-color': '#38bdf8',
        'line-width': 2.5,
        'line-dasharray': [2, 2],
      },
    });
  }, [isMapLoaded, lat, lng, radius]);

  // Render Project Pins inside chosen radius
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const p of projects) {
      if (!p.gpsLat || !p.gpsLng) continue;

      const isHovered = hoveredProjectId === p.id;
      const statusColor =
        p.flagOverdue || p.flagOverpaid
          ? '#ef4444'
          : p.isLive
          ? '#3b82f6'
          : '#10b981';

      const el = document.createElement('div');
      el.style.width = isHovered ? '20px' : '14px';
      el.style.height = isHovered ? '20px' : '14px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = isHovered ? '#00f0ff' : statusColor;
      el.style.border = '2px solid #ffffff';
      el.style.boxShadow = isHovered
        ? '0 0 25px #00f0ff, 0 0 35px #00f0ff'
        : `0 0 12px ${statusColor}, 0 2px 8px rgba(0,0,0,0.8)`;
      el.style.cursor = 'pointer';
      el.style.transition = 'all 0.15s ease-in-out';

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        router.push(`/map?project=${encodeURIComponent(p.id)}`);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([p.gpsLng, p.gpsLat])
        .addTo(map);

      markersRef.current.push(marker);
    }
  }, [isMapLoaded, projects, hoveredProjectId, router]);

  const handleSelectPreset = (presetLat: number, presetLng: number) => {
    setLat(presetLat);
    setLng(presetLng);
    setManualLat(presetLat.toFixed(5));
    setManualLng(presetLng.toFixed(5));
    setGeoStatus('granted');
    setGeoError(null);
  };

  const handleApplyManualCoords = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = parseFloat(manualLat);
    const parsedLng = parseFloat(manualLng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      setLat(parsedLat);
      setLng(parsedLng);
      setGeoStatus('granted');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-950 text-white select-none">
      {/* Top Floating Control Bar */}
      <div className="border-b border-white/10 bg-slate-900/90 px-4 py-3 backdrop-blur-md z-20 shrink-0">
        <div className="mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Title & Radius Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-base font-bold text-white flex items-center gap-1.5">
              <span>📍 Near Me</span>
              <span className="text-xs text-blue-400 font-mono">({radius} km radius)</span>
            </h1>

            {/* Radius Options */}
            <div className="flex items-center rounded-xl bg-black/60 p-1 border border-white/15 text-xs font-semibold">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRadius(r)}
                  className={`rounded-lg px-3 py-1 transition ${
                    radius === r ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {r} km
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons & Presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={requestLocation}
              disabled={geoStatus === 'locating'}
              className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white shadow hover:bg-blue-700 transition disabled:opacity-50"
            >
              {geoStatus === 'locating' ? 'Locating...' : '📍 Refresh GPS'}
            </button>

            {/* City Presets Dropdown */}
            <select
              onChange={(e) => {
                const idx = parseInt(e.target.value, 10);
                if (!isNaN(idx)) handleSelectPreset(PH_PRESETS[idx].lat, PH_PRESETS[idx].lng);
              }}
              className="rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold text-white border border-white/15 focus:outline-none"
            >
              <option value="" className="bg-gray-900 text-white">City Presets...</option>
              {PH_PRESETS.map((city, idx) => (
                <option key={city.name} value={idx} className="bg-gray-900 text-white">
                  {city.name}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold text-white border border-white/15 focus:outline-none"
            >
              <option value="All" className="bg-gray-900 text-white">All Categories</option>
              {PROJECT_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                <option key={cat} value={cat} className="bg-gray-900 text-white">
                  {cat}
                </option>
              ))}
            </select>

            {/* Basemap Switcher */}
            <div className="flex items-center rounded-xl bg-black/60 p-1 border border-white/15 text-xs">
              <button
                onClick={() => setBasemap('satellite')}
                className={`rounded-lg px-2 py-1 ${basemap === 'satellite' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
              >
                🛰️
              </button>
              <button
                onClick={() => setBasemap('dark')}
                className={`rounded-lg px-2 py-1 ${basemap === 'dark' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
              >
                🌑
              </button>
              <button
                onClick={() => setBasemap('streets')}
                className={`rounded-lg px-2 py-1 ${basemap === 'streets' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
              >
                🗺️
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Layout: Left Map canvas, Right Sidebar project list */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Interactive Map Canvas */}
        <div className="flex-1 h-full relative">
          <div ref={mapContainerRef} className="h-full w-full" />

          {/* Map Overlay Badge */}
          <div className="absolute bottom-4 left-4 z-10 rounded-xl bg-black/80 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md border border-white/15 shadow-xl">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-ping" />
              <span>Center GPS: {lat?.toFixed(4)}°N, {lng?.toFixed(4)}°E</span>
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              Showing {projects.length} infrastructure contracts in {radius} km radius
            </div>
          </div>
        </div>

        {/* Right Sidebar: List of Projects within Chosen Radius */}
        <div className="w-full sm:w-[420px] lg:w-[460px] h-full border-l border-white/10 bg-slate-900/95 backdrop-blur-md flex flex-col z-10 shrink-0">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-white/10 bg-black/40 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🏗️ Nearby Projects List</span>
                <span className="rounded-full bg-blue-600/80 px-2 py-0.5 text-[11px] font-bold text-white">
                  {projects.length}
                </span>
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Click any project card to open inspection & focus map
              </p>
            </div>

            {/* Quick Count Badge */}
            <span className="text-xs font-mono font-bold text-cyan-400">
              {radius} KM RANGE
            </span>
          </div>

          {/* Scrollable Project Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-white/10 rounded w-1/2" />
                    <div className="h-2 bg-white/10 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : projects.length > 0 ? (
              projects.map((project) => {
                const flags: string[] = [];
                if (project.flagStalled) flags.push('Stalled');
                if (project.flagNeverStarted) flags.push('Never Started');
                if (project.flagOverdue) flags.push('Overdue');
                if (project.flagOverpaid) flags.push('Overpaid');

                const statusClass = STATUS_COLORS[project.status] ?? 'bg-gray-700 text-white';

                return (
                  <div
                    key={project.id}
                    onMouseEnter={() => setHoveredProjectId(project.id)}
                    onMouseLeave={() => setHoveredProjectId(null)}
                    onClick={() => router.push(`/map?project=${encodeURIComponent(project.id)}`)}
                    className={`group cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
                      hoveredProjectId === project.id
                        ? 'border-cyan-400 bg-blue-950/60 shadow-lg shadow-cyan-500/20 translate-x-1'
                        : 'border-white/10 bg-black/40 hover:border-blue-400/50 hover:bg-white/5'
                    }`}
                  >
                    {/* Top Row: Distance Badge & Status */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 border border-blue-400/30 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300">
                        📍 {formatDistance(Number(project.distance))} away
                      </span>

                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass}`}>
                        {project.status}
                      </span>
                    </div>

                    {/* Project Title */}
                    <h3 className="text-xs font-bold text-white group-hover:text-cyan-300 transition line-clamp-2 leading-snug">
                      {project.name}
                    </h3>

                    {/* Contractor & Location */}
                    <p className="mt-1 text-[11px] text-gray-400 truncate">
                      🏗️ {cleanContractorName(project.contractorRaw || 'DPWH Project')}
                    </p>

                    {/* Budget & Progress */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] bg-white/5 p-2 rounded-lg border border-white/5">
                      <div>
                        <span className="text-gray-400 text-[9px] block">CONTRACT BUDGET</span>
                        <span className="font-bold text-cyan-300">{formatCurrency(project.budgetPHP)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-[9px] block">ACCOMPLISHMENT</span>
                        <span className="font-bold text-blue-400">{project.progress.toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5">
                      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-cyan-400 transition-all duration-300"
                          style={{ width: `${Math.min(Math.max(project.progress, 0), 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Anomaly Badges & Inspect Action */}
                    <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px]">
                      <div className="flex flex-wrap gap-1">
                        {flags.map((flag) => (
                          <span
                            key={flag}
                            className="rounded-full bg-red-950/80 border border-red-500/40 text-red-300 px-2 py-0.5 text-[10px] font-bold"
                          >
                            ⚠️ {flag}
                          </span>
                        ))}
                        {flags.length === 0 && (
                          <span className="text-[10px] text-gray-500">No anomaly flags</span>
                        )}
                      </div>

                      <span className="font-bold text-cyan-400 group-hover:translate-x-1 transition flex items-center gap-1">
                        Inspect &rarr;
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-gray-400 space-y-2">
                <p className="text-sm font-semibold text-white">No Projects in {radius} km Radius</p>
                <p className="text-xs text-gray-400">
                  Try selecting a larger search radius (e.g. 10 km or 25 km) or choosing a city preset above.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
