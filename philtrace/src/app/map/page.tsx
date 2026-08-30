'use client';

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { formatCurrency } from '@/lib/format';
import { isWithinReviewRadius, MAX_REVIEW_RADIUS_KM } from '@/lib/geo';
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

interface GeoFeature {
  type: 'Feature';
  id?: number | string;
  properties?: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: unknown;
  };
}

interface GeoJSONData {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

interface ProjectItem {
  id: string;
  name: string;
  budgetPHP: number;
  progress: number;
  status: string;
  gpsLat?: number;
  gpsLng?: number;
  flagOverdue?: boolean;
  flagOverpaid?: boolean;
  flagStalled?: boolean;
  flagNeverStarted?: boolean;
  avgRating?: number;
  province?: {
    name?: string;
    region?: {
      name?: string;
    };
  };
}

interface ChoroplethStat {
  psgcCode: string;
  name: string;
  projectCount: number;
  totalBudgetPHP: number;
  flaggedCount: number;
  avgProgress: number;
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
  const [currentZoom, setCurrentZoom] = useState<number>(5.8);

  // GeoJSON & Choropleth Data
  const [regionGeoJson, setRegionGeoJson] = useState<GeoJSONData | null>(null);
  const [provinceGeoJson, setProvinceGeoJson] = useState<GeoJSONData | null>(null);
  const [choroplethData, setChoroplethData] = useState<ChoroplethStat[]>([]);

  // Hierarchical Drill-down State: Philippines > Region > Province > Municipality > Barangay
  const [hierarchy, setHierarchy] = useState<LocationHierarchy | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('');
  const [selectedBarangay, setSelectedBarangay] = useState<string>('');
  const [filterAnomaly, setFilterAnomaly] = useState<string>('All');
  const [barangayProjects, setBarangayProjects] = useState<ProjectItem[]>([]);

  // User GPS Location
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: false, timeout: 8000 }
      );
    }
  }, []);

  // Load URL search parameters
  useEffect(() => {
    const timer = setTimeout(() => {
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
    }, 0);
    return () => clearTimeout(timer);
  }, [searchParams]);

  // Fly map camera to selected project
  useEffect(() => {
    if (!selectedProjectId || !isMapLoaded || !mapRef.current) return;

    fetch(`/api/projects/${selectedProjectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const p = data?.project || data;
        if (p?.gpsLat && p?.gpsLng && mapRef.current) {
          mapRef.current.flyTo({
            center: [p.gpsLng, p.gpsLat],
            zoom: 15.0,
            pitch: 35,
            duration: 1600,
          });
        }
      })
      .catch(console.error);
  }, [selectedProjectId, isMapLoaded]);

  // Load Hierarchy & Choropleth Data
  useEffect(() => {
    fetch('/api/locations/hierarchy')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d) setHierarchy(d);
      })
      .catch(console.error);

    fetch('/api/map/choropleth')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.data) setChoroplethData(d.data);
      })
      .catch(console.error);
  }, []);

  // Load GeoJSON Boundaries
  useEffect(() => {
    fetch('/geo/regions.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setRegionGeoJson(data);
      })
      .catch(console.error);

    fetch('/geo/provinces.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setProvinceGeoJson(data);
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

    map.on('zoom', () => {
      setCurrentZoom(map.getZoom());
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setIsMapLoaded(false);
    };
  }, [basemap]);

  // Render Province Polygon Choropleth (Zoom 5-7)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || !provinceGeoJson) return;

    if (map.getLayer('province-choropleth-layer')) map.removeLayer('province-choropleth-layer');
    if (map.getLayer('province-borders-layer')) map.removeLayer('province-borders-layer');
    if (map.getSource('province-source')) map.removeSource('province-source');

    // Create a map from province name/PSGC to project counts
    const countMap = new Map<string, number>();
    choroplethData.forEach((stat) => {
      countMap.set(stat.name.toLowerCase().trim(), stat.projectCount);
      countMap.set(stat.psgcCode, stat.projectCount);
    });

    const enrichedFeatures = provinceGeoJson.features.map((feature: any) => {
      const provName = (feature.properties?.province_name || feature.properties?.name || '') as string;
      const count = countMap.get(provName.toLowerCase().trim()) || 0;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          projectCount: count,
        },
      };
    });

    map.addSource('province-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: enrichedFeatures,
      },
    });

    // Level-of-detail choropleth fill layer: visible at zoom 5 to 8, fades out above zoom 8
    map.addLayer({
      id: 'province-choropleth-layer',
      type: 'fill',
      source: 'province-source',
      maxzoom: 8.5,
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['get', 'projectCount'],
          0, '#fef08a',
          50, '#f97316',
          200, '#ef4444',
          500, '#991b1b',
        ],
        'fill-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5.0, 0.6,
          7.5, 0.4,
          8.5, 0.0,
        ],
      },
    });

    map.addLayer({
      id: 'province-borders-layer',
      type: 'line',
      source: 'province-source',
      paint: {
        'line-color': '#ffffff',
        'line-width': 0.8,
        'line-opacity': 0.5,
      },
    });
  }, [isMapLoaded, provinceGeoJson, choroplethData]);

  // Load & Render Dynamic Project Pins (Level of Detail & Micro-Clustering)
  const renderMapLayers = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    try {
      const bounds = map.getBounds();
      let url = `/api/projects?limit=500`;

      // If zoomed in, use bounding-box cluster query
      if (bounds && map.getZoom() >= 8) {
        url = `/api/map/clusters?sw_lat=${bounds.getSouth()}&sw_lng=${bounds.getWest()}&ne_lat=${bounds.getNorth()}&ne_lng=${bounds.getEast()}&zoom=${map.getZoom()}&limit=600`;
      }

      if (selectedRegion) url += `&region=${encodeURIComponent(selectedRegion)}`;
      if (selectedProvince) url += `&province=${encodeURIComponent(selectedProvince)}`;
      if (filterAnomaly !== 'All') url += `&flag=${encodeURIComponent(filterAnomaly)}`;

      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json();
      let visibleProjects: ProjectItem[] = [];

      if (data.features) {
        // GeoJSON clusters response
        visibleProjects = data.features.map((f: any) => ({
          id: f.properties.id,
          name: f.properties.name,
          budgetPHP: f.properties.budgetPHP,
          progress: f.properties.progress,
          status: f.properties.status,
          category: f.properties.category,
          gpsLat: f.geometry.coordinates[1],
          gpsLng: f.geometry.coordinates[0],
          flagOverdue: f.properties.flagOverdue,
          flagOverpaid: f.properties.flagOverpaid,
          flagStalled: f.properties.flagStalled,
          flagNeverStarted: f.properties.flagNeverStarted,
          avgRating: f.properties.avgRating,
        }));
      } else {
        visibleProjects = data.projects || [];
      }

      // Update barangay projects list if barangay selected
      if (selectedBarangay) {
        setBarangayProjects(visibleProjects.slice(0, 15));
      }

      // Clear existing markers & popups
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      popupsRef.current.forEach((p) => p.remove());
      popupsRef.current = [];

      const zoom = map.getZoom();

      // Render pins if zoom >= 8 or drill-down active
      if (zoom >= 7.5 || selectedRegion || selectedProvince) {
        for (const p of visibleProjects) {
          if (!p.gpsLng || !p.gpsLat) continue;

          const isTarget = selectedProjectId && p.id === selectedProjectId;

          // Color by worst anomaly flag (Red = Overpaid/Stalled, Amber = Overdue/NeverStarted, Green = Normal)
          let statusColor = '#10b981';
          if (p.flagOverpaid || p.flagStalled) {
            statusColor = '#ef4444';
          } else if (p.flagOverdue || p.flagNeverStarted) {
            statusColor = '#f59e0b';
          }

          const el = document.createElement('div');
          if (isTarget) {
            el.style.width = '22px';
            el.style.height = '22px';
            el.style.borderRadius = '50%';
            el.style.backgroundColor = '#00f0ff';
            el.style.border = '3px solid #ffffff';
            el.style.boxShadow = '0 0 25px #00f0ff, 0 0 45px #00f0ff, 0 4px 12px rgba(0,0,0,0.8)';
            el.style.cursor = 'pointer';
            el.style.zIndex = '50';
          } else {
            el.style.width = zoom >= 14 ? '16px' : '12px';
            el.style.height = zoom >= 14 ? '16px' : '12px';
            el.style.borderRadius = '50%';
            el.style.backgroundColor = statusColor;
            el.style.border = '2px solid #ffffff';
            el.style.boxShadow = `0 0 10px ${statusColor}`;
            el.style.cursor = 'pointer';
          }

          // Zoom 14+: On-map project label
          if (zoom >= 14 && !isTarget) {
            const labelSpan = document.createElement('span');
            labelSpan.innerText = p.name.slice(0, 24) + '...';
            labelSpan.style.position = 'absolute';
            labelSpan.style.left = '20px';
            labelSpan.style.top = '-2px';
            labelSpan.style.backgroundColor = 'rgba(15, 23, 42, 0.85)';
            labelSpan.style.color = '#ffffff';
            labelSpan.style.fontSize = '9px';
            labelSpan.style.fontWeight = 'bold';
            labelSpan.style.padding = '2px 6px';
            labelSpan.style.borderRadius = '4px';
            labelSpan.style.whiteSpace = 'nowrap';
            labelSpan.style.pointerEvents = 'none';
            el.appendChild(labelSpan);
          }

          const popup = new mapboxgl.Popup({
            offset: [0, isTarget ? -16 : -10],
            closeButton: false,
            closeOnClick: false,
            anchor: 'bottom',
          }).setHTML(`
            <div style="background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(8px); border-radius: 10px; padding: 8px; color: #ffffff; font-family: system-ui, sans-serif; min-width: 220px; font-size: 11px;">
              <div style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">${p.province?.name || 'DPWH Project'}</div>
              <div style="font-weight: 700; margin-top: 2px;">${p.name.slice(0, 70)}...</div>
              <div style="margin-top: 4px; display: flex; justify-content: space-between;">
                <span style="color: #94a3b8;">Budget:</span>
                <span style="color: #38bdf8; font-weight: bold;">${formatCurrency(p.budgetPHP)}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #94a3b8;">Progress:</span>
                <span style="color: #60a5fa; font-weight: bold;">${p.progress.toFixed(1)}%</span>
              </div>
            </div>
          `);

          el.addEventListener('mouseenter', () => {
            if (mapRef.current) popup.addTo(mapRef.current);
          });
          el.addEventListener('mouseleave', () => {
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
      }
    } catch (err) {
      console.error('Error rendering map pins:', err);
    }
  }, [isMapLoaded, selectedRegion, selectedProvince, selectedBarangay, filterAnomaly, selectedProjectId]);

  useEffect(() => {
    renderMapLayers();
  }, [renderMapLayers, currentZoom]);

  return (
    <div className="relative h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-950">
      {/* Mapbox Container */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Floating Level-of-Detail & Drill-Down Control Panel */}
      <div className="absolute top-4 left-4 z-20 w-80 max-w-[calc(100vw-2rem)] bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-gray-200 shadow-xl space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-black text-gray-900 uppercase tracking-wider text-[11px]">
            🇵🇭 Geospatial Inspector
          </span>
          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            Zoom {currentZoom.toFixed(1)}
          </span>
        </div>

        {/* Hierarchical Breadcrumbs */}
        <div className="text-[10px] text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100 flex flex-wrap items-center gap-1 font-medium">
          <button
            onClick={() => {
              setSelectedRegion('');
              setSelectedProvince('');
              setSelectedMunicipality('');
              setSelectedBarangay('');
            }}
            className="text-blue-600 font-bold hover:underline"
          >
            Philippines
          </button>
          {selectedRegion && (
            <>
              <span>&gt;</span>
              <span className="font-bold text-gray-800">{selectedRegion}</span>
            </>
          )}
          {selectedProvince && (
            <>
              <span>&gt;</span>
              <span className="font-bold text-gray-800">{selectedProvince}</span>
            </>
          )}
          {selectedBarangay && (
            <>
              <span>&gt;</span>
              <span className="font-bold text-emerald-700">{selectedBarangay}</span>
            </>
          )}
        </div>

        {/* Drill-down Selectors */}
        <div className="space-y-2">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">Region</label>
            <select
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setSelectedProvince('');
                setSelectedMunicipality('');
                setSelectedBarangay('');
              }}
              className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-semibold text-gray-800 focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Regions (Nationwide)</option>
              {hierarchy?.regions.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {selectedRegion && (
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Province</label>
              <select
                value={selectedProvince}
                onChange={(e) => {
                  setSelectedProvince(e.target.value);
                  setSelectedMunicipality('');
                  setSelectedBarangay('');
                }}
                className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-semibold text-gray-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Provinces in Region</option>
                {hierarchy?.regions
                  .find((r) => r.name === selectedRegion)
                  ?.provinces.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {selectedProvince && (
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Barangay Ground Search</label>
              <input
                type="text"
                placeholder="Enter Barangay name (e.g. San Jose)..."
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Anomaly Filter */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase">Filter Risk Flags</label>
          <select
            value={filterAnomaly}
            onChange={(e) => setFilterAnomaly(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-semibold text-gray-800 focus:border-blue-500 focus:outline-none"
          >
            <option value="All">All Projects</option>
            <option value="overpaid">🚨 Overpaid (&lt;30% progress, &gt;80% paid)</option>
            <option value="stalled">⚠️ Stalled (No activity 180+ days)</option>
            <option value="overdue">🟡 Overdue Contracts</option>
            <option value="neverStarted">Never Started</option>
          </select>
        </div>

        {/* Basemap Switcher */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <span className="text-[10px] font-bold text-gray-500">Basemap</span>
          <div className="flex rounded-lg bg-gray-100 p-0.5 text-[10px] font-bold">
            {(['satellite', 'streets', 'dark'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setBasemap(mode)}
                className={`px-2 py-0.5 rounded capitalize transition ${
                  basemap === mode ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Barangay Project List Sidebar Drawer (when Barangay active) */}
      {selectedBarangay && barangayProjects.length > 0 && (
        <div className="absolute top-4 right-4 z-20 w-80 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-gray-200 shadow-xl space-y-2.5 max-h-[calc(100vh-120px)] overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="font-black text-gray-900 text-xs">
              📍 Projects in {selectedBarangay} ({barangayProjects.length})
            </span>
            <button
              onClick={() => setSelectedBarangay('')}
              className="text-gray-400 hover:text-gray-700 text-xs font-bold"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1.5">
            {barangayProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className="w-full text-left p-2.5 rounded-xl border border-gray-100 bg-gray-50 hover:bg-blue-50/60 hover:border-blue-200 transition text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-gray-500">{p.id}</span>
                  <span className="text-[10px] font-bold text-blue-600">{p.progress.toFixed(0)}%</span>
                </div>
                <p className="font-bold text-gray-900 line-clamp-2 text-[11px]">{p.name}</p>
                <p className="text-[10px] font-semibold text-emerald-600">{formatCurrency(p.budgetPHP)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Project Inspection Drawer */}
      <ProjectInspectionDrawer
        projectId={selectedProjectId}
        onClose={() => setSelectedProjectId(null)}
      />
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-slate-950" />}>
      <MapContent />
    </Suspense>
  );
}
