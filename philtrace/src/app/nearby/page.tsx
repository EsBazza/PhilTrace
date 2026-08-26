'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useNearbyProjects, type ProjectWithRelations } from '@/hooks/use-projects';
import { formatCurrency, formatDistance, cleanContractorName } from '@/lib/format';
import { STATUS_COLORS, FLAG_COLORS, PROJECT_CATEGORIES } from '@/lib/constants';

interface NearbyProject extends ProjectWithRelations {
  distance: number;
}

const RADIUS_OPTIONS = [1, 5, 10, 25];

const PH_PRESETS = [
  { name: 'Manila (National Capital)', lat: 14.5995, lng: 120.9842 },
  { name: 'Quezon City', lat: 14.6488, lng: 121.0509 },
  { name: 'Cebu City', lat: 10.3157, lng: 123.8854 },
  { name: 'Davao City', lat: 7.0731, lng: 125.6128 },
  { name: 'Baguio City', lat: 16.4124, lng: 120.5960 },
  { name: 'Iloilo City', lat: 10.6969, lng: 122.5644 },
  { name: 'Cagayan de Oro', lat: 8.4822, lng: 124.6472 },
  { name: 'Pampanga (San Fernando)', lat: 15.0343, lng: 120.6844 },
];

export default function NearbyPage() {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radius, setRadius] = useState<number>(5);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'prompt' | 'locating' | 'granted' | 'denied' | 'error' | 'unsupported'>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);

  // Manual input state
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLng, setManualLng] = useState<string>('');
  const [manualInputOpen, setManualInputOpen] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

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
        if (error.code === error.PERMISSION_DENIED) {
          setGeoStatus('denied');
          setGeoError('Location permission was denied. Please enter coordinates manually or choose a city preset below.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setGeoStatus('error');
          setGeoError('Location information is unavailable. Please try again or use manual coordinates.');
        } else if (error.code === error.TIMEOUT) {
          setGeoStatus('error');
          setGeoError('Location request timed out. Please try again or enter coordinates manually.');
        } else {
          setGeoStatus('error');
          setGeoError('An unknown error occurred while retrieving your location.');
        }
        setManualInputOpen(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

  // Request location automatically on initial mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const handleApplyManualCoords = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = parseFloat(manualLat);
    const parsedLng = parseFloat(manualLng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setGeoError('Please enter valid numeric latitude and longitude values.');
      return;
    }

    if (parsedLat < 4 || parsedLat > 22 || parsedLng < 114 || parsedLng > 128) {
      setGeoError('Coordinates seem outside the Philippine territory (Lat ~4-21°N, Lng ~116-127°E). Please verify.');
    } else {
      setGeoError(null);
    }

    setLat(parsedLat);
    setLng(parsedLng);
    setGeoStatus('granted');
  };

  const handleSelectPreset = (presetLat: number, presetLng: number) => {
    setLat(presetLat);
    setLng(presetLng);
    setManualLat(presetLat.toFixed(5));
    setManualLng(presetLng.toFixed(5));
    setGeoStatus('granted');
    setGeoError(null);
  };

  // Fetch nearby projects via hook
  const { data, isLoading, isFetching, error, refetch } = useNearbyProjects(lat, lng, radius);

  const rawProjects = (data?.projects as NearbyProject[]) || [];

  // Filter client-side if status or category filters are applied
  const projects = rawProjects.filter((p) => {
    if (selectedCategory !== 'All' && !p.category.toLowerCase().includes(selectedCategory.toLowerCase())) {
      return false;
    }
    if (selectedStatus !== 'All' && p.status !== selectedStatus) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>📍</span> Projects Near Me
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Discover and inspect DPWH public infrastructure projects around your current physical location.
          </p>
        </div>

        {/* Location Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={requestLocation}
            disabled={geoStatus === 'locating'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 transition"
          >
            {geoStatus === 'locating' ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Locating...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{lat !== null ? 'Refresh GPS' : 'Get My Location'}</span>
              </>
            )}
          </button>

          <button
            onClick={() => setManualInputOpen(!manualInputOpen)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>{manualInputOpen ? 'Hide Coordinates' : 'Manual Coordinates'}</span>
          </button>
        </div>
      </div>

      {/* Geolocation Status / Alert Notifications */}
      {geoStatus === 'locating' && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 animate-pulse">
          <svg className="h-5 w-5 animate-spin text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <div>
            <p className="font-semibold">Acquiring GPS coordinates...</p>
            <p className="text-xs text-blue-600">Please allow browser location permissions if prompted.</p>
          </div>
        </div>
      )}

      {(geoStatus === 'denied' || geoStatus === 'error' || geoStatus === 'unsupported' || geoError) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold">
                {geoStatus === 'denied' ? 'Location Access Blocked' : 'Location Not Detected'}
              </p>
              <p className="mt-0.5 text-xs text-amber-800">
                {geoError || 'Unable to access automatic GPS location. Use the manual coordinate input or select a Philippine city preset below to find nearby projects.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Coordinates & Control Bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        {/* Radius Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-900 block">
              Search Radius: <span className="text-blue-600 font-bold">{radius} km</span>
            </label>
            <p className="text-xs text-gray-500">
              Select or slide to expand search coverage area
            </p>
          </div>

          <div className="flex items-center gap-2">
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setRadius(opt)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  radius === opt
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600 ring-offset-1'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {opt} km
              </button>
            ))}
          </div>
        </div>

        {/* Radius Slider */}
        <div>
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>1 km (Immediate neighborhood)</span>
            <span>25 km (Metropolitan area)</span>
          </div>
          <input
            type="range"
            min="1"
            max="25"
            step="1"
            value={radius}
            onChange={(e) => setRadius(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        {/* Current Coordinate Info Badge */}
        {lat !== null && lng !== null && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-gray-50 p-2.5 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-gray-700">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span>
                Searching center: <strong className="text-gray-900">{lat.toFixed(4)}°N, {lng.toFixed(4)}°E</strong>
              </span>
            </div>
            <span className="text-gray-500">
              Max Distance: {radius} km
            </span>
          </div>
        )}

        {/* Manual Coordinates Input & City Presets (Collapsible / Toggleable) */}
        {manualInputOpen && (
          <div className="pt-2 border-t border-gray-100 space-y-4">
            <form onSubmit={handleApplyManualCoords} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Latitude (°N)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 14.5995"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Longitude (°E)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 120.9842"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black transition shadow-sm"
                >
                  Set Coordinates
                </button>
              </div>
            </form>

            {/* Quick Philippine City Presets */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">
                Quick Philippine City Presets:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PH_PRESETS.map((city) => (
                  <button
                    key={city.name}
                    type="button"
                    onClick={() => handleSelectPreset(city.lat, city.lng)}
                    className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition"
                  >
                    {city.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Chips & Result Counter */}
      {lat !== null && lng !== null && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              Nearby Projects
            </h2>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
              {projects.length} found
            </span>
            {isFetching && !isLoading && (
              <span className="text-xs text-gray-400 animate-pulse">Updating...</span>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category select */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Categories</option>
              {PROJECT_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Status select */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="On-Going">On-Going</option>
              <option value="Completed">Completed</option>
              <option value="Not Yet Started">Not Yet Started</option>
              <option value="Suspended">Suspended</option>
              <option value="Terminated">Terminated</option>
            </select>
          </div>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="h-4 w-24 rounded-full bg-blue-100" />
                <div className="h-4 w-16 rounded-full bg-gray-200" />
              </div>
              <div className="h-5 w-3/4 rounded bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-200" />
              <div className="pt-2 flex justify-between">
                <div className="h-4 w-20 rounded bg-gray-200" />
                <div className="h-3 w-16 rounded bg-gray-200" />
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200" />
            </div>
          ))}
        </div>
      )}

      {/* Query Error State */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-800">
            Failed to load nearby projects. Please try refreshing or adjusting your search parameters.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-3 inline-flex items-center rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition"
          >
            Retry Query
          </button>
        </div>
      )}

      {/* Empty State: Coordinates not set */}
      {!isLoading && !error && lat === null && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-4">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">No Location Selected</h3>
          <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">
            Click &ldquo;Get My Location&rdquo; above to use your device&apos;s GPS or select a city preset to explore infrastructure projects nearby.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={requestLocation}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm"
            >
              Get My Location
            </button>
            <button
              onClick={() => handleSelectPreset(14.5995, 120.9842)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Browse Manila
            </button>
          </div>
        </div>
      )}

      {/* Empty State: Coordinates set but no projects found */}
      {!isLoading && !error && lat !== null && projects.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-3">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">
            No Infrastructure Projects Found
          </h3>
          <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
            We couldn&apos;t find any DPWH projects within <strong className="text-gray-800">{radius} km</strong> of your coordinates ({lat?.toFixed(4)}°N, {lng?.toFixed(4)}°E).
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {radius < 25 && (
              <button
                onClick={() => setRadius(25)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                Expand Radius to 25 km
              </button>
            )}
            <button
              onClick={() => handleSelectPreset(14.5995, 120.9842)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Try Manila
            </button>
            <button
              onClick={() => handleSelectPreset(10.3157, 123.8854)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Try Cebu
            </button>
          </div>
        </div>
      )}

      {/* Sorted Projects Grid */}
      {!isLoading && !error && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const flags: string[] = [];
            if (project.flagStalled) flags.push('Stalled');
            if (project.flagNeverStarted) flags.push('Never Started');
            if (project.flagOverdue) flags.push('Overdue');
            if (project.flagOverpaid) flags.push('Overpaid');

            const statusClass = STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-800';

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group relative flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div>
                  {/* Top Bar: Distance badge + Status pill */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    {/* Distance Badge ("1.2 km away") */}
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                      <svg className="h-3.5 w-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {formatDistance(Number(project.distance))}
                    </span>

                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}>
                      {project.status}
                    </span>
                  </div>

                  {/* Project Name */}
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition line-clamp-2">
                    {project.name}
                  </h3>

                  {/* Contractor info */}
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    🏗️ {cleanContractorName(project.contractorRaw || 'Unassigned')}
                  </p>

                  {/* Financial & Category details */}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-sm font-bold text-gray-900">
                      {formatCurrency(project.budgetPHP)}
                    </span>
                    <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                      {project.category}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Accomplishment</span>
                      <span className="font-semibold text-gray-800">
                        {typeof project.progress === 'number' ? project.progress.toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${Math.min(Math.max(project.progress, 0), 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Anomaly flags & Live badge */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-1">
                  {project.isLive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-ping" />
                      LIVE
                    </span>
                  )}
                  {flags.map((flag) => (
                    <span
                      key={flag}
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        FLAG_COLORS[flag] ?? 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      ⚠️ {flag}
                    </span>
                  ))}
                  {flags.length === 0 && !project.isLive && (
                    <span className="text-xs text-gray-400">No anomaly flags</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
