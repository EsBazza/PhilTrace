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

  // Load & Render Dynamic Project GeoJSON Layers (Heatmap + Clusters + Pins)
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

      // Clear existing DOM markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Convert projects to GeoJSON
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: projects
          .filter((p: any) => p.gpsLat && p.gpsLng && !isNaN(p.gpsLat) && !isNaN(p.gpsLng))
          .map((p: any) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [p.gpsLng, p.gpsLat],
            },
            properties: {
              id: p.id,
              name: p.name,
              budgetPHP: p.budgetPHP,
              progress: p.progress,
              status: p.status,
              contractor: p.contractorRaw,
              province: p.province?.name || '',
              isLive: p.isLive,
              flagOverdue: p.flagOverdue,
              flagOverpaid: p.flagOverpaid,
              avgRating: p.avgRating || 0,
            },
          })),
      };

      // Add / Update GeoJSON source
      if (map.getSource('dpwh-projects')) {
        (map.getSource('dpwh-projects') as mapboxgl.GeoJSONSource).setData(geojson);
      } else {
        map.addSource('dpwh-projects', {
          type: 'geojson',
          data: geojson,
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 50,
        });

        // 1. Heatmap Layer (Visible at low zoom)
        map.addLayer({
          id: 'projects-heat',
          type: 'heatmap',
          source: 'dpwh-projects',
          maxzoom: 11,
          paint: {
            'heatmap-weight': [
              'interpolate',
              ['linear'],
              ['get', heatmapMetric === 'budget' ? 'budgetPHP' : 'progress'],
              0, 0,
              100000000, 1,
            ],
            'heatmap-intensity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 1,
              11, 3,
            ],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(33,102,172,0)',
              0.2, 'rgb(103,169,207)',
              0.4, 'rgb(209,229,240)',
              0.6, 'rgb(253,219,199)',
              0.8, 'rgb(239,138,98)',
              1, 'rgb(178,24,43)',
            ],
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 4,
              11, 24,
            ],
            'heatmap-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              7, 0.8,
              11, 0,
            ],
          },
        });

        // 2. Cluster Circles (Zoom 8 - 12)
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'dpwh-projects',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#3b82f6',
              20, '#f59e0b',
              100, '#ef4444',
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              16,
              20, 22,
              100, 30,
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        // 3. Cluster Count Numbers
        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'dpwh-projects',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12,
          },
          paint: {
            'text-color': '#ffffff',
          },
        });

        // Click on cluster zooms in
        map.on('click', 'clusters', (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
          const clusterId = features[0]?.properties?.cluster_id;
          (map.getSource('dpwh-projects') as mapboxgl.GeoJSONSource).getClusterExpansionZoom(
            clusterId,
            (err, zoom) => {
              if (err || !zoom) return;
              map.easeTo({
                center: (features[0].geometry as any).coordinates,
                zoom,
              });
            }
          );
        });

        map.on('mouseenter', 'clusters', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'clusters', () => {
          map.getCanvas().style.cursor = '';
        });
      }

      // Add individual interactive DOM Markers for high precision
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
        el.style.boxShadow = '0 0 8px rgba(0,0,0,0.6)';
        el.style.cursor = 'pointer';
        el.style.transition = 'transform 0.15s ease';

        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.4)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
        });

        const popup = new mapboxgl.Popup({ offset: 14, closeButton: false }).setHTML(`
          <div style="font-family: sans-serif; padding: 6px; max-width: 240px;">
            <div style="font-size: 9px; font-weight: 800; color: #6b7280; text-transform: uppercase;">${p.province?.name || 'DPWH Project'}</div>
            <div style="font-size: 11px; font-weight: bold; margin-top: 2px; color: #111827; line-height: 1.3;">${p.name.slice(0, 70)}...</div>
            <div style="font-size: 11px; margin-top: 4px; color: #374151;"><strong>Budget:</strong> ${formatCurrency(p.budgetPHP)}</div>
            <div style="font-size: 11px; color: #374151;"><strong>Progress:</strong> ${p.progress.toFixed(1)}%</div>
            <div style="font-size: 10px; color: #f59e0b; margin-top: 2px; font-weight: bold;">⭐ ${p.avgRating > 0 ? p.avgRating.toFixed(1) : 'No reviews yet'}</div>
            <div style="display: inline-block; margin-top: 6px; font-size: 11px; color: #2563eb; font-weight: 700;">Click to Inspect & Rate &rarr;</div>
          </div>
        `);

        const marker = new mapboxgl.Marker(el)
          .setLngLat([p.gpsLng, p.gpsLat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener('click', () => {
          setSelectedProjectId(p.id);
        });

        markersRef.current.push(marker);
      }
    } catch (err) {
      console.error('Error rendering map layers:', err);
    }
  }, [isMapLoaded, selectedRegion, selectedProvince, filterCategory, filterAnomaly, searchQuery, heatmapMetric]);

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

    // Zoom to specific region coordinates
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

        {/* Right: Basemap & Heatmap Toggles */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Heatmap Metric */}
          {mapMode === 'free_roam' && (
            <div className="flex items-center rounded-xl bg-black/80 p-1 backdrop-blur-md border border-white/15 shadow-xl text-xs font-semibold text-white">
              <button
                onClick={() => setHeatmapMetric('budget')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  heatmapMetric === 'budget' ? 'bg-amber-600 text-white' : 'text-gray-300'
                }`}
                title="Heatmap by Public Budget (₱)"
              >
                💰 Budget Heat
              </button>
              <button
                onClick={() => setHeatmapMetric('count')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  heatmapMetric === 'count' ? 'bg-blue-600 text-white' : 'text-gray-300'
                }`}
                title="Heatmap by Contract Count"
              >
                📊 Density
              </button>
            </div>
          )}

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
