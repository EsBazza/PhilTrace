'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

interface ClusterFeature {
  type: 'Feature';
  id?: number;
  properties: Record<string, any>;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

interface Filters {
  region?: string;
  province?: string;
  flags?: string[];
  category?: string;
}

export function useSupercluster() {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const resolversRef = useRef<Map<string, (data: any) => void>>(new Map());

  // Initialize worker and do a two-phase data load
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/cluster.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e) => {
      const { type, data, totalPoints: tp, phase } = e.data;

      switch (type) {
        case 'ready':
          setIsReady(true);
          setTotalPoints(tp);
          resolversRef.current.get('load')?.(tp);
          resolversRef.current.delete('load');

          // Phase 1 done → load the full 62MB dataset in the background
          if (phase === 'initial') {
            fetch('/geo/all_projects.json')
              .then((res) => res.json())
              .then((geojson) => {
                worker.postMessage({
                  type: 'load',
                  payload: { features: geojson.features, metadata: geojson.metadata },
                });
              })
              .catch((err) => {
                console.warn('Full dataset load failed, staying on initial data:', err);
              });
          }
          break;
        case 'clusters':
          resolversRef.current.get('getClusters')?.(data);
          resolversRef.current.delete('getClusters');
          break;
        case 'filtered':
          setTotalPoints(tp);
          resolversRef.current.get('filter')?.(tp);
          resolversRef.current.delete('filter');
          break;
        case 'leaves':
          resolversRef.current.get('getLeaves')?.(data);
          resolversRef.current.delete('getLeaves');
          break;
        case 'expansionZoom':
          resolversRef.current.get('expansionZoom')?.(e.data.zoom);
          resolversRef.current.delete('expansionZoom');
          break;
      }
    };

    workerRef.current = worker;

    // ── Phase 1: Load the small 1.6MB initial dataset first → map shows immediately ──
    fetch('/geo/initial_clusters.json')
      .then((res) => res.json())
      .then((geojson) => {
        worker.postMessage({
          type: 'loadSimple',
          payload: { features: geojson.features },
        });
      })
      .catch(() => {
        // Fallback: skip to full load if initial_clusters.json missing
        fetch('/geo/all_projects.json')
          .then((res) => res.json())
          .then((geojson) => {
            worker.postMessage({
              type: 'load',
              payload: { features: geojson.features, metadata: geojson.metadata },
            });
          })
          .catch((err) => {
            console.error('Failed to load project data:', err);
          });
      });

    return () => {
      worker.terminate();
      workerRef.current = null;
      setIsReady(false);
    };
  }, []);

  const getClusters = useCallback(
    (bbox: [number, number, number, number], zoom: number): Promise<ClusterFeature[]> => {
      return new Promise((resolve) => {
        if (!workerRef.current || !isReady) {
          resolve([]);
          return;
        }
        resolversRef.current.set('getClusters', resolve);
        workerRef.current.postMessage({
          type: 'getClusters',
          payload: { bbox, zoom },
        });
      });
    },
    [isReady],
  );

  const applyFilters = useCallback(
    (filters: Filters): Promise<number> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          resolve(0);
          return;
        }
        resolversRef.current.set('filter', resolve);
        workerRef.current.postMessage({
          type: 'filter',
          payload: { filters },
        });
      });
    },
    [],
  );

  const getLeaves = useCallback(
    (clusterId: number, limit = 100, offset = 0): Promise<ClusterFeature[]> => {
      return new Promise((resolve) => {
        if (!workerRef.current || !isReady) {
          resolve([]);
          return;
        }
        resolversRef.current.set('getLeaves', resolve);
        workerRef.current.postMessage({
          type: 'getLeaves',
          payload: { clusterId, limit, offset },
        });
      });
    },
    [isReady],
  );

  const getExpansionZoom = useCallback(
    (clusterId: number): Promise<number> => {
      return new Promise((resolve) => {
        if (!workerRef.current || !isReady) {
          resolve(16);
          return;
        }
        resolversRef.current.set('expansionZoom', resolve);
        workerRef.current.postMessage({
          type: 'expansionZoom',
          payload: { clusterId },
        });
      });
    },
    [isReady],
  );

  return {
    isReady,
    totalPoints,
    getClusters,
    applyFilters,
    getLeaves,
    getExpansionZoom,
  };
}
