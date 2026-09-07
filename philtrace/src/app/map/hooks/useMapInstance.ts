'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';

const BASEMAP_STYLES: Record<string, string> = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
  streets: 'mapbox://styles/mapbox/outdoors-v12',
};

const PHILIPPINES_BOUNDS: [[number, number], [number, number]] = [
  [114.0, 4.0],
  [128.5, 22.0],
];

export function useMapInstance(
  containerRef: React.RefObject<HTMLDivElement | null>,
  basemap: string,
) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(5.8);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container,
      style: BASEMAP_STYLES[basemap] || BASEMAP_STYLES.satellite,
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

    map.on('load', () => setIsMapLoaded(true));

    map.on('moveend', () => {
      setCurrentZoom(map.getZoom());
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setIsMapLoaded(false);
    };
  }, [basemap, containerRef]);

  const flyTo = useCallback(
    (center: [number, number], zoom: number, padding?: mapboxgl.PaddingOptions) => {
      mapRef.current?.flyTo({
        center,
        zoom,
        duration: 1800,
        essential: true,
        pitch: zoom > 12 ? 35 : 20,
        padding: padding || { top: 50, bottom: 50, left: 350, right: 50 },
      });
    },
    [],
  );

  const fitBounds = useCallback(
    (bounds: [[number, number], [number, number]], padding?: mapboxgl.PaddingOptions) => {
      mapRef.current?.fitBounds(bounds, {
        duration: 1800,
        essential: true,
        padding: padding || { top: 60, bottom: 60, left: 370, right: 60 },
        maxZoom: 17,
      });
    },
    [],
  );

  return { mapRef, isMapLoaded, currentZoom, flyTo, fitBounds };
}
