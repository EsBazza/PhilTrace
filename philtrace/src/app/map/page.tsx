'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { formatCurrency } from '@/lib/format';
import ProjectInspectionDrawer from '@/components/project-inspection-drawer';
import DrillDownPanel from './components/DrillDownPanel';
import ProjectSidebar from './components/ProjectSidebar';
import { useMapInstance } from './hooks/useMapInstance';
import { useLocationHierarchy } from './hooks/useLocationHierarchy';
import { useSupercluster } from './hooks/useSupercluster';
import { useDrillDown } from './hooks/useDrillDown';

// ─── Choropleth Types ───────────────────────────────────────
interface ChoroplethStat {
  psgcCode: string;
  name: string;
  projectCount: number;
  totalBudgetPHP: number;
  flaggedCount: number;
  avgProgress: number;
}

// ─── Main Map Content ───────────────────────────────────────
function MapContent() {
  const searchParams = useSearchParams();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Basemap state
  const [basemap, setBasemap] = useState<'satellite' | 'dark' | 'streets'>('satellite');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Core hooks
  const { mapRef, isMapLoaded, currentZoom, flyTo, fitBounds } = useMapInstance(mapContainerRef, basemap);
  const { sortedRegions, centroids, getProvinces, getCities } = useLocationHierarchy();
  const { isReady, totalPoints, getClusters, applyFilters, getLeaves, getExpansionZoom } = useSupercluster();

  const drillDown = useDrillDown(centroids, flyTo, fitBounds);

  // Choropleth data
  const [choroplethData, setChoroplethData] = useState<ChoroplethStat[]>([]);
  const [provinceGeoJson, setProvinceGeoJson] = useState<any>(null);

  // Sidebar projects
  const [sidebarProjects, setSidebarProjects] = useState<any[]>([]);

  // GeoJSON source ref for updating data
  const clusterSourceRef = useRef<string>('supercluster-source');
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load URL params ──────────────────────────────────────
  useEffect(() => {
    const r = searchParams.get('region');
    const p = searchParams.get('province');
    const m = searchParams.get('city') || searchParams.get('municipality');
    const projId = searchParams.get('project') || searchParams.get('projectId');
    if (r) drillDown.setRegion(r);
    if (p) drillDown.setProvince(p);
    if (m) drillDown.setMunicipality(m);
    if (projId) setSelectedProjectId(projId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ─── Fly to selected project ──────────────────────────────
  useEffect(() => {
    if (!selectedProjectId || !isMapLoaded || !mapRef.current) return;
    fetch(`/api/projects/${selectedProjectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const p = data?.project || data;
        if (p?.gpsLat && p?.gpsLng) {
          flyTo([p.gpsLng, p.gpsLat], 15);
        }
      })
      .catch(console.error);
  }, [selectedProjectId, isMapLoaded, mapRef, flyTo]);

  // ─── Load choropleth + province boundaries ────────────────
  useEffect(() => {
    fetch('/api/map/choropleth')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => { if (d?.data) setChoroplethData(d.data); })
      .catch(console.error);

    fetch('/geo/provinces.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setProvinceGeoJson(data); })
      .catch(console.error);
  }, []);

  // ─── Apply filters to Supercluster when drill-down changes ─
  useEffect(() => {
    if (!isReady) return;

    const filters: Record<string, any> = {};
    if (drillDown.region) filters.region = drillDown.region;
    if (drillDown.province) filters.province = drillDown.province;
    if (drillDown.filterAnomaly !== 'All') {
      const flagMap: Record<string, string> = {
        overpaid: 'flagOverpaid',
        stalled: 'flagStalled',
        overdue: 'flagOverdue',
        neverStarted: 'flagNeverStarted',
        paymentPending: 'flagPaymentPending',
      };
      const flag = flagMap[drillDown.filterAnomaly];
      if (flag) filters.flags = [flag];
    }

    const hasFilters = Object.keys(filters).length > 0;
    if (hasFilters) {
      applyFilters(filters).then(() => {
        renderClusters();
      });
    } else {
      applyFilters({}).then(() => {
        renderClusters();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, drillDown.region, drillDown.province, drillDown.filterAnomaly]);

  // ─── Render clusters from Supercluster → Mapbox ──────────
  const renderClusters = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !isReady) return;

    const bounds = map.getBounds();
    if (!bounds) return;

    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];
    const zoom = map.getZoom();

    const clusters = await getClusters(bbox, zoom);

    const source = map.getSource(clusterSourceRef.current) as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: clusters as any,
      });
    }
  }, [mapRef, isReady, getClusters]);

  // ─── Setup Mapbox layers + event handlers ─────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    // Wait for style to be loaded
    const setupLayers = () => {
      // ── BOUNDARY & MASK LAYERS (for drill-down focus) ────
      if (!map.getSource('selected-mask-source')) {
        map.addSource('selected-mask-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addLayer({
          id: 'selected-boundary-mask',
          type: 'fill',
          source: 'selected-mask-source',
          paint: {
            'fill-color': '#020617',
            'fill-opacity': 0.62,
          },
        });
      }

      if (!map.getSource('selected-boundary-source')) {
        map.addSource('selected-boundary-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        // Glowing outer blur line
        map.addLayer({
          id: 'selected-boundary-glow',
          type: 'line',
          source: 'selected-boundary-source',
          paint: {
            'line-color': '#38bdf8',
            'line-width': 6,
            'line-blur': 3,
            'line-opacity': 0.75,
          },
        });

        // Sharp vibrant neon inner line
        map.addLayer({
          id: 'selected-boundary-line',
          type: 'line',
          source: 'selected-boundary-source',
          paint: {
            'line-color': '#00f0ff',
            'line-width': 2.5,
            'line-opacity': 0.95,
          },
        });
      }

      if (map.getSource(clusterSourceRef.current)) return; // Already setup

      // Add empty GeoJSON source (Supercluster will populate it)
      map.addSource(clusterSourceRef.current, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // ── CLUSTER LAYERS ──────────────────────────────────

      // 1. Cluster outer glow
      map.addLayer({
        id: 'clusters-glow',
        type: 'circle',
        source: clusterSourceRef.current,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'totalProjects'],
            '#38bdf8',   // < 500
            500, '#34d399',
            2500, '#fbbf24',
            10000, '#fb923c',
            40000, '#f87171',
          ],
          'circle-radius': [
            'step',
            ['get', 'totalProjects'],
            24,          // < 500
            500, 30,
            2500, 38,
            10000, 46,
            40000, 56,
          ],
          'circle-opacity': 0.35,
          'circle-blur': 0.4,
        },
      });

      // 2. Cluster main blob
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: clusterSourceRef.current,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'case',
            // High anomaly density (>30%) → red
            ['>', ['/', ['get', 'flaggedCount'], ['max', ['get', 'totalProjects'], 1]], 0.3],
            '#dc2626',
            // Medium anomaly density (>10%) → amber
            ['>', ['/', ['get', 'flaggedCount'], ['max', ['get', 'totalProjects'], 1]], 0.1],
            '#d97706',
            // Default color by count
            [
              'step',
              ['get', 'totalProjects'],
              '#0284c7',
              500, '#059669',
              2500, '#d97706',
              10000, '#ea580c',
              40000, '#dc2626',
            ],
          ],
          'circle-radius': [
            'step',
            ['get', 'totalProjects'],
            18,
            500, 23,
            2500, 29,
            10000, 36,
            40000, 44,
          ],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      });

      // 3. Cluster count label
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: clusterSourceRef.current,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': [
            'case',
            ['>=', ['get', 'totalProjects'], 100000],
            ['concat', ['to-string', ['round', ['/', ['get', 'totalProjects'], 1000]]], 'k'],
            ['>=', ['get', 'totalProjects'], 10000],
            ['concat', ['to-string', ['round', ['/', ['get', 'totalProjects'], 1000]]], 'k'],
            ['>=', ['get', 'totalProjects'], 1000],
            ['concat', ['to-string', ['/', ['round', ['*', ['/', ['get', 'totalProjects'], 1000], 10]], 10]], 'k'],
            ['to-string', ['round', ['get', 'totalProjects']]],
          ],
          'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': 13,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // ── INDIVIDUAL PIN LAYERS ───────────────────────────

      // 4. Pin outer glow
      map.addLayer({
        id: 'unclustered-point-glow',
        type: 'circle',
        source: clusterSourceRef.current,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'case',
            ['==', ['coalesce', ['get', 'k'], 0], 2], '#ef4444',
            ['==', ['coalesce', ['get', 'k'], 0], 1], '#f59e0b',
            '#10b981',
          ],
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            10, 8, 14, 14, 18, 18,
          ],
          'circle-opacity': 0.38,
          'circle-blur': 0.35,
        },
      });

      // 5. Pin core circle - budget-scaled
      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: clusterSourceRef.current,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'case',
            ['==', ['coalesce', ['get', 'k'], 0], 2], '#ef4444',
            ['==', ['coalesce', ['get', 'k'], 0], 1], '#f59e0b',
            '#10b981',
          ],
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            10, [
              'interpolate', ['linear'], ['coalesce', ['get', 'b'], 0],
              0, 4.5, 1000, 5.5, 50000, 8, 500000, 11,
            ],
            18, [
              'interpolate', ['linear'], ['coalesce', ['get', 'b'], 0],
              0, 7, 1000, 9, 50000, 13, 500000, 18,
            ],
          ],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
        },
      });

      // ── EVENT HANDLERS ──────────────────────────────────

      // Click on cluster → zoom in
      map.on('click', 'clusters', async (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0]?.properties?.cluster_id;
        if (clusterId === undefined) return;

        const coords = (features[0].geometry as any).coordinates.slice();
        const currentMapZoom = map.getZoom();

        try {
          const expansionZoom = await getExpansionZoom(clusterId);
          const targetZoom = Math.min(
            Math.max(expansionZoom + 0.5, currentMapZoom + 2),
            16,
          );
          map.easeTo({ center: coords, zoom: targetZoom, duration: 650 });
        } catch {
          map.easeTo({
            center: coords,
            zoom: Math.min(currentMapZoom + 2.5, 16),
            duration: 650,
          });
        }
      });

      // Click on unclustered pin → open drawer
      map.on('click', 'unclustered-point', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['unclustered-point'] });
        const projId = features[0]?.properties?.i || features[0]?.properties?.id;
        if (projId) setSelectedProjectId(projId);
      });

      // ── HOVER TOOLTIPS ──────────────────────────────────

      const hoverPopup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
      });

      // Hover on individual pin
      map.on('mouseenter', 'unclustered-point', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const feature = e.features?.[0];
        if (!feature) return;

        const coords = (feature.geometry as any).coordinates.slice();
        const p = feature.properties || {};

        let badgeColor = '#10b981';
        let badgeText = 'Normal';
        if (p.k === 2 || p.fo || p.fs) {
          badgeColor = '#ef4444';
          badgeText = '🚨 Overpaid / Stalled';
        } else if (p.k === 1 || p.fd || p.fn) {
          badgeColor = '#f59e0b';
          badgeText = '🟡 Attention Needed';
        }

        const budget = p.b !== undefined ? (p.b < 10000000 ? p.b * 1000 : p.b) : 0;
        const progress = Number(p.g ?? p.p ?? p.progress ?? 0);
        const category = p.c || p.cat || 'Infrastructure';
        const title = p.n || p.name || 'DPWH Infrastructure Project';

        hoverPopup
          .setLngLat(coords)
          .setHTML(`
            <div style="background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(8px); border-radius: 10px; padding: 10px 13px; color: #fff; font-family: system-ui, sans-serif; min-width: 240px; font-size: 11px; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">${category}</span>
                <span style="font-size: 9px; font-weight: 700; color: ${badgeColor}; background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 4px;">${badgeText}</span>
              </div>
              <div style="font-weight: 700; margin-top: 4px; line-height: 1.35; color: #f8fafc;">${title}</div>
              <div style="margin-top: 8px; display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 5px;">
                <span style="color: #94a3b8;">Budget:</span>
                <span style="color: #38bdf8; font-weight: bold;">${formatCurrency(budget)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                <span style="color: #94a3b8;">Progress:</span>
                <span style="color: #34d399; font-weight: bold;">${progress.toFixed(1)}%</span>
              </div>
              <div style="margin-top: 6px; font-size: 9px; color: #cbd5e1; text-align: right;">Click to inspect details &rarr;</div>
            </div>
          `)
          .addTo(map);
      });

      map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = '';
        hoverPopup.remove();
      });

      // Hover on cluster
      const clusterPopup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 14,
      });

      map.on('mouseenter', 'clusters', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const feature = e.features?.[0];
        if (!feature) return;

        const coords = (feature.geometry as any).coordinates.slice();
        const p = feature.properties || {};
        const count = p.totalProjects || p.point_count || 1;
        const budget = p.totalBudget || 0;
        const flagged = p.flaggedCount || 0;
        const anomalyPct = count > 0 ? ((flagged / count) * 100).toFixed(1) : '0';

        clusterPopup
          .setLngLat(coords)
          .setHTML(`
            <div style="background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(8px); border-radius: 10px; padding: 9px 13px; color: #fff; font-family: system-ui, sans-serif; min-width: 180px; font-size: 11px; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
              <div style="font-size: 9px; font-weight: 800; color: #38bdf8; text-transform: uppercase;">Infrastructure Cluster</div>
              <div style="font-size: 13px; font-weight: 800; color: #fff; margin-top: 3px;">${Number(count).toLocaleString()} Projects</div>
              ${budget > 0 ? `<div style="font-size: 10px; color: #94a3b8; margin-top: 3px;">Budget: <span style="color: #34d399; font-weight: 700;">${formatCurrency(budget)}</span></div>` : ''}
              ${flagged > 0 ? `<div style="font-size: 10px; color: #f87171; margin-top: 2px;">⚠️ ${flagged.toLocaleString()} flagged (${anomalyPct}%)</div>` : ''}
              <div style="margin-top: 5px; font-size: 9px; color: #cbd5e1;">Click to zoom &amp; expand &rarr;</div>
            </div>
          `)
          .addTo(map);
      });

      map.on('mouseleave', 'clusters', () => {
        map.getCanvas().style.cursor = '';
        clusterPopup.remove();
      });

      // Cursor pointer for both layers
      map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseenter', 'unclustered-point', () => { map.getCanvas().style.cursor = 'pointer'; });
    };

    if (map.isStyleLoaded()) {
      setupLayers();
    } else {
      map.on('load', setupLayers);
    }

    // ── VIEWPORT CHANGE → RE-RENDER CLUSTERS ────────────
    const onMoveEnd = () => {
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
      renderTimeoutRef.current = setTimeout(() => {
        renderClusters();
      }, 80);
    };

    map.on('moveend', onMoveEnd);
    map.on('zoomend', onMoveEnd);

    return () => {
      map.off('moveend', onMoveEnd);
      map.off('zoomend', onMoveEnd);
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    };
  }, [isMapLoaded, mapRef, renderClusters, getExpansionZoom]);

  // ─── Trigger initial render when Supercluster is ready ────
  useEffect(() => {
    if (isReady && isMapLoaded) {
      renderClusters();
    }
  }, [isReady, isMapLoaded, renderClusters]);

  // ─── Province Choropleth (zoom 5-7.5) ─────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || !provinceGeoJson) return;

    if (map.getLayer('province-choropleth-layer')) map.removeLayer('province-choropleth-layer');
    if (map.getLayer('province-borders-layer')) map.removeLayer('province-borders-layer');
    if (map.getSource('province-source')) map.removeSource('province-source');

    const countMap = new Map<string, number>();
    choroplethData.forEach((stat) => {
      countMap.set(stat.name.toLowerCase().trim(), stat.projectCount);
      countMap.set(stat.psgcCode, stat.projectCount);
    });

    const enrichedFeatures = provinceGeoJson.features.map((feature: any) => {
      const provName = (feature.properties?.province_name || feature.properties?.name || feature.properties?.PROVINCE || '') as string;
      const count = countMap.get(provName.toLowerCase().trim()) || 0;
      return {
        ...feature,
        properties: { ...feature.properties, projectCount: count },
      };
    });

    map.addSource('province-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: enrichedFeatures },
    });

    map.addLayer({
      id: 'province-choropleth-layer',
      type: 'fill',
      source: 'province-source',
      maxzoom: 7.5,
      paint: {
        'fill-color': [
          'interpolate', ['linear'], ['get', 'projectCount'],
          0, '#fef08a', 50, '#f97316', 200, '#ef4444', 500, '#991b1b',
        ],
        'fill-opacity': [
          'interpolate', ['linear'], ['zoom'],
          5.0, 0.45, 6.5, 0.25, 7.5, 0.0,
        ],
      },
    });

    map.addLayer({
      id: 'province-borders-layer',
      type: 'line',
      source: 'province-source',
      maxzoom: 7.5,
      paint: {
        'line-color': '#ffffff',
        'line-width': 0.8,
        'line-opacity': 0.35,
      },
    });
  }, [isMapLoaded, provinceGeoJson, choroplethData, mapRef]);

  // ─── Update Boundary Outline & Inverted Dark Mask ──────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    const boundarySource = map.getSource('selected-boundary-source') as mapboxgl.GeoJSONSource | undefined;
    const maskSource = map.getSource('selected-mask-source') as mapboxgl.GeoJSONSource | undefined;

    // Determine currently selected boundary level
    let boundaryType: string | null = null;
    let boundaryName: string = '';
    let cityFile: string = '';

    if (drillDown.barangay) {
      boundaryType = 'barangay';
      boundaryName = drillDown.barangay;
    } else if (drillDown.municipality) {
      boundaryType = 'city';
      boundaryName = drillDown.municipality;
      cityFile = drillDown.cityFile || '';
    } else if (drillDown.province) {
      boundaryType = 'province';
      boundaryName = drillDown.province;
    } else if (drillDown.region) {
      boundaryType = 'region';
      boundaryName = drillDown.region;
    }

    if (!boundaryType) {
      // Clear boundary and mask when nationwide / no drill-down selection
      if (boundarySource) boundarySource.setData({ type: 'FeatureCollection', features: [] });
      if (maskSource) maskSource.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const params = new URLSearchParams({
      type: boundaryType,
      name: boundaryName,
    });
    if (cityFile) params.set('cityFile', cityFile);

    fetch(`/api/locations/boundary?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;

        if (boundarySource && data.boundary) {
          boundarySource.setData({
            type: 'FeatureCollection',
            features: [data.boundary],
          });
        }

        if (maskSource && data.mask) {
          maskSource.setData({
            type: 'FeatureCollection',
            features: [data.mask],
          });
        }
      })
      .catch((err) => {
        console.error('Failed to load boundary and mask:', err);
      });
  }, [
    isMapLoaded,
    mapRef,
    drillDown.region,
    drillDown.province,
    drillDown.municipality,
    drillDown.cityFile,
    drillDown.barangay,
  ]);

  // ─── Update sidebar when municipality/barangay changes ────
  useEffect(() => {
    if (!isReady || (!drillDown.municipality && !drillDown.barangay)) {
      setSidebarProjects([]);
      return;
    }

    // Get leaves at current view
    const map = mapRef.current;
    if (!map) return;

    const bounds = map.getBounds();
    if (!bounds) return;

    const bbox: [number, number, number, number] = [
      bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth(),
    ];

    getClusters(bbox, 16).then((features) => {
      // Filter to individual points only (not clusters)
      let points = features.filter((f: any) => !f.properties?.cluster);

      if (drillDown.municipality) {
        const muniLower = drillDown.municipality.toLowerCase();
        points = points.filter((f: any) =>
          (f.properties?.n || '').toLowerCase().includes(muniLower) ||
          (f.properties?.prov || '').toLowerCase().includes(muniLower)
        );
      }

      if (drillDown.barangay) {
        const bgryLower = drillDown.barangay.toLowerCase();
        points = points.filter((f: any) =>
          (f.properties?.n || '').toLowerCase().includes(bgryLower)
        );
      }

      setSidebarProjects(points.slice(0, 30));
    });
  }, [isReady, drillDown.municipality, drillDown.barangay, mapRef, getClusters]);

  return (
    <div className="relative h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-950">
      {/* Mapbox Container */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Drill-Down Panel */}
      <DrillDownPanel
        currentZoom={currentZoom}
        totalPoints={totalPoints}
        isReady={isReady}
        sortedRegions={sortedRegions}
        region={drillDown.region}
        province={drillDown.province}
        municipality={drillDown.municipality}
        barangay={drillDown.barangay}
        filterAnomaly={drillDown.filterAnomaly}
        setRegion={drillDown.setRegion}
        setProvince={drillDown.setProvince}
        setMunicipality={drillDown.setMunicipality}
        setBarangay={drillDown.setBarangay}
        setFilterAnomaly={drillDown.setFilterAnomaly}
        navigateTo={drillDown.navigateTo}
        basemap={basemap}
        setBasemap={setBasemap}
        getProvinces={getProvinces}
        getCities={getCities}
      />

      {/* Project Sidebar */}
      {(drillDown.municipality || drillDown.barangay) && sidebarProjects.length > 0 && (
        <ProjectSidebar
          title={drillDown.barangay || drillDown.municipality}
          projects={sidebarProjects}
          onSelectProject={setSelectedProjectId}
          onClose={() => {
            drillDown.setMunicipality('');
            drillDown.setBarangay('');
          }}
        />
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
