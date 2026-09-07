'use client';

import { useState, useCallback } from 'react';
import type { Centroids } from './useLocationHierarchy';

export interface DrillDownState {
  region: string;
  province: string;
  municipality: string;
  cityFile?: string;
  barangay: string;
  filterAnomaly: string;
}

export function useDrillDown(
  centroids: Centroids | null,
  flyTo: (center: [number, number], zoom: number) => void,
  fitBounds: (bounds: [[number, number], [number, number]]) => void,
) {
  const [state, setState] = useState<DrillDownState>({
    region: '',
    province: '',
    municipality: '',
    cityFile: '',
    barangay: '',
    filterAnomaly: 'All',
  });

  const setRegion = useCallback(
    (region: string) => {
      setState({
        region,
        province: '',
        municipality: '',
        cityFile: '',
        barangay: '',
        filterAnomaly: state.filterAnomaly,
      });

      if (!region) {
        // Reset to nationwide view
        flyTo([122.0, 12.8], 5.8);
        return;
      }

      if (centroids?.regions) {
        const c =
          centroids.regions[region] ||
          centroids.regions[region.toLowerCase().trim()];
        if (c?.bounds) {
          fitBounds(c.bounds);
          return;
        }
      }

      // Fallback default
      flyTo([122.0, 12.8], 6.5);
    },
    [centroids, flyTo, fitBounds, state.filterAnomaly],
  );

  const setProvince = useCallback(
    (province: string) => {
      setState((prev) => ({ ...prev, province, municipality: '', cityFile: '', barangay: '' }));
      if (!province) return;

      if (centroids?.provinces) {
        const c =
          centroids.provinces[province] ||
          centroids.provinces[province.toLowerCase().trim()] ||
          centroids.provinces[`${state.region}::${province}`];
        if (c?.bounds) {
          fitBounds(c.bounds);
          return;
        }
      }

      // Fallback: look up a project in this province
      fetch(`/api/projects?limit=1&province=${encodeURIComponent(province)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const p = data?.projects?.[0];
          if (p?.gpsLng && p?.gpsLat) {
            flyTo([p.gpsLng, p.gpsLat], 9.5);
          }
        })
        .catch(console.error);
    },
    [centroids, fitBounds, flyTo, state.region],
  );

  const setMunicipality = useCallback(
    (municipality: string, cityFile?: string) => {
      setState((prev) => ({ ...prev, municipality, cityFile: cityFile || '', barangay: '' }));
      if (!municipality) return;

      if (centroids?.cities) {
        const c =
          (cityFile ? centroids.cities[cityFile] : null) ||
          centroids.cities[municipality] ||
          centroids.cities[municipality.toLowerCase().trim()] ||
          centroids.cities[`${state.province}::${municipality}`];
        if (c?.bounds) {
          fitBounds(c.bounds);
          return;
        }
      }

      // Fallback: fly to city location via project GPS lookup
      fetch(
        `/api/projects?limit=1&province=${encodeURIComponent(state.province || '')}&search=${encodeURIComponent(municipality)}`,
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const p = data?.projects?.[0];
          if (p?.gpsLng && p?.gpsLat) {
            flyTo([p.gpsLng, p.gpsLat], 12.0);
          }
        })
        .catch(console.error);
    },
    [centroids, fitBounds, flyTo, state.province],
  );

  const setBarangay = useCallback(
    (barangay: string, bounds?: [[number, number], [number, number]]) => {
      setState((prev) => ({ ...prev, barangay }));
      if (!barangay) return;

      if (bounds) {
        fitBounds(bounds);
        return;
      }

      // Fallback: fly to barangay location via project GPS lookup
      fetch(`/api/projects?limit=1&search=${encodeURIComponent(barangay)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const p = data?.projects?.[0];
          if (p?.gpsLng && p?.gpsLat) {
            flyTo([p.gpsLng, p.gpsLat], 14.5);
          }
        })
        .catch(console.error);
    },
    [fitBounds, flyTo],
  );

  const setFilterAnomaly = useCallback((filterAnomaly: string) => {
    setState((prev) => ({ ...prev, filterAnomaly }));
  }, []);

  const resetAll = useCallback(() => {
    setState({
      region: '',
      province: '',
      municipality: '',
      barangay: '',
      filterAnomaly: 'All',
    });
    flyTo([122.0, 12.8], 5.8);
  }, [flyTo]);

  // Navigate breadcrumb: clicking a level resets everything below it
  const navigateTo = useCallback(
    (level: 'root' | 'region' | 'province' | 'municipality') => {
      switch (level) {
        case 'root':
          resetAll();
          break;
        case 'region': {
          setState((prev) => ({
            ...prev,
            province: '',
            municipality: '',
            barangay: '',
          }));
          if (state.region && centroids?.regions) {
            const c =
              centroids.regions[state.region] ||
              centroids.regions[state.region.toLowerCase().trim()];
            if (c?.bounds) fitBounds(c.bounds);
          }
          break;
        }
        case 'province': {
          setState((prev) => ({ ...prev, municipality: '', barangay: '' }));
          if (state.province && centroids?.provinces) {
            const c =
              centroids.provinces[state.province] ||
              centroids.provinces[state.province.toLowerCase().trim()] ||
              centroids.provinces[`${state.region}::${state.province}`];
            if (c?.bounds) fitBounds(c.bounds);
          }
          break;
        }
        case 'municipality': {
          setState((prev) => ({ ...prev, barangay: '' }));
          if (state.municipality && centroids?.cities) {
            const c =
              centroids.cities[state.municipality] ||
              centroids.cities[state.municipality.toLowerCase().trim()] ||
              centroids.cities[`${state.province}::${state.municipality}`];
            if (c?.bounds) fitBounds(c.bounds);
          }
          break;
        }
      }
    },
    [resetAll, state.region, state.province, state.municipality, centroids, fitBounds],
  );

  return {
    ...state,
    setRegion,
    setProvince,
    setMunicipality,
    setBarangay,
    setFilterAnomaly,
    resetAll,
    navigateTo,
  };
}
