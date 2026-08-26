'use client';

import { useState, useEffect, useCallback, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useNearbyProjects, type ProjectWithRelations } from '@/hooks/use-projects';
import { formatCurrency, formatDistance, cleanContractorName } from '@/lib/format';
import { STATUS_COLORS, PROJECT_CATEGORIES } from '@/lib/constants';
import ProjectInspectionDrawer from '@/components/project-inspection-drawer';

interface NearbyProject extends ProjectWithRelations {
  distance: number;
}

const RADIUS_OPTIONS = [1, 5, 10, 25] as const;

const BASEMAP_STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
  streets: 'mapbox://styles/mapbox/outdoors-v12',
};

const PH_PRESETS = [
  { name: 'Manila (NCR)', lat: 14.5995, lng: 120.9842 },
  { name: 'Quezon City', lat: 14.6488, lng: 121.0509 },
  { name: 'San Fernando, Pampanga', lat: 15.0343, lng: 120.6844 },
  { name: 'Cebu City', lat: 10.3157, lng: 123.8854 },
  { name: 'Davao City', lat: 7.0731, lng: 125.6128 },
  { name: 'Baguio City', lat: 16.4124, lng: 120.596 },
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
    coords.push([lng + distanceX * Math.cos(theta), lat + distanceY * Math.sin(theta)]);
  }
  coords.push(coords[0]);
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} }],
  };
}

function getStatusColor(project: NearbyProject) {
  if (project.flagOverdue || project.flagOverpaid) return '#ef4444';
  if (project.isLive) return '#3b82f6';
  return '#10b981';
}

/** Haversine distance in km between two lat/lng pairs */
function haversineKm(lat1Raw: number, lng1Raw: number, lat2Raw: number, lng2Raw: number): number {
  const lat1 = Number(lat1Raw);
  const lng1 = Number(lng1Raw);
  const lat2 = Number(lat2Raw);
  const lng2 = Number(lng2Raw);
  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) return 999999;

  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.min(
    1,
    Math.max(
      0,
      Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    )
  );
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function NearbyPage() {
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [, startTransition] = useTransition();

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radius, setRadius] = useState<number>(5);
  const [basemap, setBasemap] = useState<'satellite' | 'dark' | 'streets'>('satellite');
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'granted' | 'denied'>('idle');
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const handleSelectProject = useCallback((id: string, gpsLng?: number, gpsLat?: number) => {
    setSelectedProjectId(id);
    if (gpsLng && gpsLat && mapRef.current) {
      mapRef.current.flyTo({
        center: [gpsLng, gpsLat],
        zoom: 15.0,
        pitch: 35,
        duration: 1200,
      });
    }
  }, []);

  // ─── Geolocation ──────────────────────────────────────────────────────────
  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLat(14.5995);
      setLng(120.9842);
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        startTransition(() => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setGeoStatus('granted');
        });
      },
      () => {
        setLat(14.5995);
        setLng(120.9842);
        setGeoStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  // ─── Data Fetch & Radius Filtering ─────────────────────────────────────
  const { data, isLoading } = useNearbyProjects(lat, lng, radius);
  const allProjects = (data?.projects as NearbyProject[]) ?? [];

  const projects = allProjects
    .map((p) => {
      const dist = lat !== null && lng !== null && p.gpsLat && p.gpsLng
        ? haversineKm(lat, lng, p.gpsLat, p.gpsLng)
        : Number(p.distance ?? 999999);
      return { ...p, distance: dist };
    })
    .filter((p) => {
      if (!p.gpsLat || !p.gpsLng) return false;
      if (lat !== null && lng !== null && p.distance > radius) return false;
      if (selectedCategory !== 'All' && !p.category.toLowerCase().includes(selectedCategory.toLowerCase())) {
        return false;
      }
      return true;
    });

  // ─── Mapbox Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: BASEMAP_STYLES[basemap],
      center: [lng ?? 120.9842, lat ?? 14.5995],
      zoom: radius <= 2 ? 14 : radius <= 5 ? 12.5 : radius <= 10 ? 11 : 9.8,
      pitch: 20,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-left');
    map.on('load', () => setIsMapLoaded(true));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setIsMapLoaded(false);
    };
  }, [basemap]);

  // ─── Radius Circle + User Marker ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || lat === null || lng === null) return;

    map.flyTo({
      center: [lng, lat],
      zoom: radius <= 2 ? 14 : radius <= 5 ? 12.5 : radius <= 10 ? 11 : 9.8,
      duration: 900,
    });

    // User marker
    if (userMarkerRef.current) userMarkerRef.current.remove();
    const userEl = document.createElement('div');
    userEl.style.cssText = `
      width: 20px; height: 20px; border-radius: 50%;
      background: #2563eb; border: 3px solid #fff;
      box-shadow: 0 0 0 6px rgba(37,99,235,0.25), 0 0 20px #2563eb;
    `;
    userMarkerRef.current = new mapboxgl.Marker({ element: userEl, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(map);

    // Radius circle
    (['radius-circle-line', 'radius-circle-fill'] as const).forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource('radius-circle')) map.removeSource('radius-circle');

    map.addSource('radius-circle', { type: 'geojson', data: createGeoJSONCircle([lng, lat], radius) as any });
    map.addLayer({ id: 'radius-circle-fill', type: 'fill', source: 'radius-circle', paint: { 'fill-color': '#0ea5e9', 'fill-opacity': 0.08 } });
    map.addLayer({ id: 'radius-circle-line', type: 'line', source: 'radius-circle', paint: { 'line-color': '#38bdf8', 'line-width': 2, 'line-dasharray': [3, 2] } });
    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, [isMapLoaded, lat, lng, radius]);

  // ─── Project Pins: create once, never re-mount on hover ──────────────────
  const pinElsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    pinElsRef.current.clear();

    console.log('--- Rendering Map Pins ---', projects.length, { lat, lng, radius });
    for (const p of projects) {
      if (!p.gpsLat || !p.gpsLng) continue;
      // Client-side radius guard: skip any pin whose GPS is outside chosen radius
      const dist = lat !== null && lng !== null ? haversineKm(lat, lng, p.gpsLat, p.gpsLng) : 999999;
      if (dist > radius) {
        console.log('Skipping pin outside radius:', p.name, { lat: p.gpsLat, lng: p.gpsLng, dist });
        continue;
      }
      console.log('Adding pin inside radius:', p.name, { lat: p.gpsLat, lng: p.gpsLng, dist });
      const color = getStatusColor(p);
      const el = document.createElement('div');
      el.style.cssText = `
        width: 13px; height: 13px; border-radius: 50%;
        background: ${color}; border: 2px solid #fff;
        box-shadow: 0 0 10px ${color}, 0 2px 6px rgba(0,0,0,0.7);
        cursor: pointer; transition: box-shadow 0.15s ease, background 0.15s ease;
        pointer-events: auto; position: relative;
      `;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        handleSelectProject(p.id, p.gpsLng, p.gpsLat);
      });
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([p.gpsLng, p.gpsLat])
        .addTo(map);
      markersRef.current.push(marker);
      pinElsRef.current.set(p.id, el);
    }
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      pinElsRef.current.clear();
    };
  }, [isMapLoaded, projects, lat, lng, radius, handleSelectProject]);

  // ─── Hover: update pin styles only, never re-mount markers ───────────────
  useEffect(() => {
    for (const [id, el] of pinElsRef.current.entries()) {
      const project = projects.find((p) => p.id === id);
      if (!project) continue;
      const isHov = hoveredProjectId === id;
      const color = getStatusColor(project);
      el.style.background = isHov ? '#00f0ff' : color;
      el.style.boxShadow = isHov
        ? '0 0 22px #00f0ff, 0 0 38px rgba(0,240,255,0.5)'
        : `0 0 10px ${color}, 0 2px 6px rgba(0,0,0,0.7)`;
    }
  }, [hoveredProjectId, projects]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#0f172a', color: '#fff', overflow: 'hidden' }}>

      {/* ── Top Control Bar ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        gap: '10px', padding: '10px 16px', background: 'rgba(2,6,23,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, zIndex: 20,
      }}>
        {/* Left: title + radius */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            📍 Near Me
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#38bdf8', background: 'rgba(56,189,248,0.12)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(56,189,248,0.3)' }}>
              {radius} km radius
            </span>
          </span>

          {/* Radius Pills */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRadius(r)}
                style={{
                  padding: '4px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                  background: radius === r ? '#2563eb' : 'transparent',
                  color: radius === r ? '#fff' : 'rgba(255,255,255,0.5)',
                  boxShadow: radius === r ? '0 0 12px rgba(37,99,235,0.5)' : 'none',
                }}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>

        {/* Right: controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* GPS Button */}
          <button
            onClick={requestLocation}
            disabled={geoStatus === 'locating'}
            style={{
              padding: '5px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', border: 'none', background: '#2563eb', color: '#fff',
              opacity: geoStatus === 'locating' ? 0.6 : 1, transition: 'all 0.15s',
            }}
          >
            {geoStatus === 'locating' ? '⏳ Locating…' : '📡 GPS Location'}
          </button>

          {/* City Presets */}
          <select
            onChange={(e) => {
              const idx = parseInt(e.target.value, 10);
              if (!isNaN(idx)) { setLat(PH_PRESETS[idx].lat); setLng(PH_PRESETS[idx].lng); }
            }}
            style={{ padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', outline: 'none' }}
          >
            <option value="">📌 City Presets</option>
            {PH_PRESETS.map((c, i) => (
              <option key={c.name} value={i} style={{ background: '#1e293b' }}>{c.name}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', outline: 'none' }}
          >
            <option value="All" style={{ background: '#1e293b' }}>All Categories</option>
            {PROJECT_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
              <option key={cat} value={cat} style={{ background: '#1e293b' }}>{cat}</option>
            ))}
          </select>

          {/* Basemap Toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
            {(['satellite', 'dark', 'streets'] as const).map((style) => (
              <button
                key={style}
                onClick={() => setBasemap(style)}
                title={style}
                style={{
                  padding: '4px 8px', borderRadius: '7px', fontSize: '14px', cursor: 'pointer',
                  border: 'none', transition: 'all 0.15s',
                  background: basemap === style ? '#334155' : 'transparent',
                }}
              >
                {style === 'satellite' ? '🛰️' : style === 'dark' ? '🌑' : '🗺️'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Split Layout ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* ── LEFT: Map ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

          {/* GPS Overlay */}
          {lat !== null && (
            <div style={{
              position: 'absolute', bottom: '16px', left: '16px', zIndex: 10,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
              padding: '8px 14px', fontSize: '11px', fontFamily: 'monospace',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block', animation: 'ping 1s infinite' }} />
                {lat.toFixed(4)}°N, {lng?.toFixed(4)}°E
              </div>
              <div style={{ color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                {projects.length} project{projects.length !== 1 ? 's' : ''} within {radius} km
              </div>
            </div>
          )}

          {/* Slide-out Google Maps-style Inspection Drawer */}
          <ProjectInspectionDrawer
            projectId={selectedProjectId}
            onClose={() => setSelectedProjectId(null)}
          />
        </div>

        {/* ── RIGHT: Sidebar ────────────────────────────────────────── */}
        <div style={{
          width: '400px', minWidth: '360px', flexShrink: 0,
          display: 'flex', flexDirection: 'column', height: '100%',
          background: 'rgba(2,8,23,0.98)', borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}>
          {/* Sidebar Header */}
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>🏗️ Nearby Projects</span>
                <span style={{
                  background: '#2563eb', color: '#fff', borderRadius: '20px',
                  padding: '1px 9px', fontSize: '11px', fontWeight: 700,
                }}>
                  {projects.length}
                </span>
              </div>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                {radius} KM RANGE
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
              Click any project to open it on the main map
            </p>
          </div>

          {/* Scrollable Project List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '14px', opacity: 0.6 }}>
                  <div style={{ height: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', width: '70%', marginBottom: '8px' }} />
                  <div style={{ height: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', width: '45%' }} />
                </div>
              ))
            ) : projects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.4)' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                <div style={{ fontWeight: 700, color: '#fff', marginBottom: '6px' }}>No Projects Found</div>
                <div style={{ fontSize: '12px' }}>Try a larger radius or a different city preset.</div>
              </div>
            ) : (
              projects.map((project) => {
                const isHovered = hoveredProjectId === project.id;
                const statusBg = STATUS_COLORS[project.status] ?? 'bg-gray-700 text-white';
                const flags: string[] = [];
                if (project.flagStalled) flags.push('Stalled');
                if (project.flagNeverStarted) flags.push('Never Started');
                if (project.flagOverdue) flags.push('Overdue');
                if (project.flagOverpaid) flags.push('Overpaid');
                const dotColor = getStatusColor(project);
                const progressPct = Math.min(Math.max(project.progress, 0), 100);

                return (
                  <div
                    key={project.id}
                    onMouseEnter={() => setHoveredProjectId(project.id)}
                    onMouseLeave={() => setHoveredProjectId(null)}
                    onClick={() => handleSelectProject(project.id, project.gpsLng, project.gpsLat)}
                    style={{
                      borderRadius: '12px', padding: '14px', cursor: 'pointer',
                      border: `1px solid ${isHovered ? '#00f0ff' : 'rgba(255,255,255,0.08)'}`,
                      background: isHovered ? 'rgba(0,240,255,0.06)' : 'rgba(255,255,255,0.02)',
                      boxShadow: isHovered ? '0 0 20px rgba(0,240,255,0.12)' : 'none',
                      transition: 'all 0.15s ease',
                      transform: isHovered ? 'translateX(3px)' : 'none',
                    }}
                  >
                    {/* Row 1: Distance + Status */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.25)',
                        color: '#7dd3fc', borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: 700,
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, display: 'inline-block', boxShadow: `0 0 8px ${dotColor}` }} />
                        📍 {formatDistance(Number(project.distance))}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBg}`}>
                        {project.status}
                      </span>
                    </div>

                    {/* Project Name */}
                    <h3 style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: isHovered ? '#00f0ff' : '#f1f5f9', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {project.name}
                    </h3>

                    {/* Contractor */}
                    <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      🏗️ {cleanContractorName(project.contractorRaw || 'DPWH Project')}
                    </p>

                    {/* Budget + Progress Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Budget</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#7dd3fc' }}>{formatCurrency(project.budgetPHP)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Progress</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#34d399' }}>{project.progress.toFixed(1)}%</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ height: '4px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: '10px' }}>
                      <div style={{
                        height: '100%', borderRadius: '999px',
                        width: `${progressPct}%`,
                        background: progressPct >= 90 ? '#34d399' : progressPct >= 50 ? '#3b82f6' : '#f59e0b',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>

                    {/* Footer: flags + action */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '8px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {flags.length > 0 ? flags.map((f) => (
                          <span key={f} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: '20px', padding: '1px 8px', fontSize: '10px', fontWeight: 700 }}>
                            ⚠️ {f}
                          </span>
                        )) : (
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>No anomaly flags</span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', transition: 'all 0.15s', transform: isHovered ? 'translateX(3px)' : 'none' }}>
                        Inspect →
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
