'use client';

import { useMemo, useState, useEffect } from 'react';

interface CityItem {
  id: string;
  name: string;
  file?: string;
}

interface ProvinceItem {
  id: string;
  name: string;
  cities: CityItem[];
}

interface RegionItem {
  id: string;
  name: string;
  provinces: ProvinceItem[];
}

interface BarangayItem {
  name: string;
  bounds?: [[number, number], [number, number]];
  center?: [number, number];
  zoom?: number;
}

interface DrillDownPanelProps {
  currentZoom: number;
  totalPoints: number;
  isReady: boolean;
  // Sorted regions
  sortedRegions: RegionItem[];
  // Current selections
  region: string;
  province: string;
  municipality: string;
  barangay: string;
  filterAnomaly: string;
  // Handlers
  setRegion: (v: string) => void;
  setProvince: (v: string) => void;
  setMunicipality: (v: string, file?: string) => void;
  setBarangay: (v: string, bounds?: [[number, number], [number, number]]) => void;
  setFilterAnomaly: (v: string) => void;
  navigateTo: (level: 'root' | 'region' | 'province' | 'municipality') => void;
  // Basemap
  basemap: string;
  setBasemap: (v: 'satellite' | 'dark' | 'streets') => void;
  // Computed data
  getProvinces: (regionName: string) => ProvinceItem[];
  getCities: (regionName: string, provinceName: string) => CityItem[];
}

export default function DrillDownPanel({
  currentZoom,
  totalPoints,
  isReady,
  sortedRegions,
  region,
  province,
  municipality,
  barangay,
  filterAnomaly,
  setRegion,
  setProvince,
  setMunicipality,
  setBarangay,
  setFilterAnomaly,
  navigateTo,
  basemap,
  setBasemap,
  getProvinces,
  getCities,
}: DrillDownPanelProps) {
  const currentProvinces = useMemo(() => getProvinces(region), [region, getProvinces]);
  const currentCities = useMemo(() => getCities(region, province), [region, province, getCities]);

  // Barangay dropdown data loaded from /api/locations/barangays with REAL bounds
  const [barangays, setBarangays] = useState<BarangayItem[]>([]);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  useEffect(() => {
    if (!municipality || currentCities.length === 0) {
      setBarangays([]);
      return;
    }

    const city = currentCities.find((c) => c.name.toLowerCase() === municipality.toLowerCase());
    if (city?.file) {
      setLoadingBarangays(true);
      fetch(`/api/locations/barangays?cityFile=${encodeURIComponent(city.file)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.barangays) {
            setBarangays(data.barangays);
          } else {
            setBarangays([]);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingBarangays(false));
    } else {
      setBarangays([]);
    }
  }, [municipality, currentCities]);

  const formatCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  return (
    <div className="absolute top-4 left-4 z-20 w-80 max-w-[calc(100vw-2rem)] bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-gray-200 shadow-xl space-y-3 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-black text-gray-900 uppercase tracking-wider text-[11px]">
          🇵🇭 Geospatial Inspector
        </span>
        <div className="flex items-center gap-2">
          {isReady && (
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              {formatCount(totalPoints)} projects
            </span>
          )}
          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            Zoom {currentZoom.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Loading indicator */}
      {!isReady && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] font-semibold text-blue-700">Loading 248k+ projects...</span>
        </div>
      )}

      {/* Hierarchical Breadcrumbs */}
      <div className="text-[10px] text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100 flex flex-wrap items-center gap-1 font-medium">
        <button
          onClick={() => navigateTo('root')}
          className="text-blue-600 font-bold hover:underline"
        >
          Philippines
        </button>
        {region && (
          <>
            <span className="text-gray-400">&gt;</span>
            <button
              onClick={() => navigateTo('region')}
              className="text-blue-600 font-bold hover:underline"
            >
              {region.replace(/\s*\(.*\)/, '').slice(0, 25)}
            </button>
          </>
        )}
        {province && (
          <>
            <span className="text-gray-400">&gt;</span>
            <button
              onClick={() => navigateTo('province')}
              className="text-blue-600 font-bold hover:underline"
            >
              {province}
            </button>
          </>
        )}
        {municipality && (
          <>
            <span className="text-gray-400">&gt;</span>
            <button
              onClick={() => navigateTo('municipality')}
              className="text-blue-700 font-bold hover:underline"
            >
              {municipality}
            </button>
          </>
        )}
        {barangay && (
          <>
            <span className="text-gray-400">&gt;</span>
            <span className="font-bold text-emerald-700">{barangay}</span>
          </>
        )}
      </div>

      {/* Drill-down Selectors */}
      <div className="space-y-2">
        {/* Level 1: Region */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase">
            1. Region ({sortedRegions.length || 17})
          </label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-semibold text-gray-800 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Regions (Nationwide)</option>
            {sortedRegions.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Level 2: Province */}
        {region && (
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">
              2. Province ({currentProvinces.length})
            </label>
            <select
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-semibold text-gray-800 focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Provinces in {region.replace(/\s*\(.*\)/, '')}</option>
              {currentProvinces.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Level 3: City / Municipality */}
        {province && (
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">
              3. City / Municipality ({currentCities.length})
            </label>
            <select
              value={municipality}
              onChange={(e) => {
                const val = e.target.value;
                const cityItem = currentCities.find((c) => c.name === val);
                setMunicipality(val, cityItem?.file);
              }}
              className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-semibold text-gray-800 focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Cities in {province} ({currentCities.length})</option>
              {currentCities.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Level 4: Barangay Dropdown (from official 41k barangay GeoJSON boundaries) */}
        {(municipality || province) && (
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-500 uppercase">
                4. Barangay {barangays.length > 0 ? `(${barangays.length})` : ''}
              </label>
              {loadingBarangays && (
                <span className="text-[9px] text-blue-500 animate-pulse font-semibold">
                  Loading...
                </span>
              )}
            </div>

            {barangays.length > 0 ? (
              <select
                value={barangay}
                onChange={(e) => {
                  const val = e.target.value;
                  const bObj = barangays.find((b) => b.name === val);
                  setBarangay(val, bObj?.bounds);
                }}
                className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-semibold text-gray-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Barangays in {municipality} ({barangays.length})</option>
                {barangays.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Search barangay (e.g. Poblacion, San Jose)..."
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
              />
            )}
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
          <option value="paymentPending">💰 Payment Pending</option>
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
  );
}
