import Supercluster from 'supercluster';

let supercluster: any = null;
let masterFeatures: any[] = [];
let currentFeatures: any[] = [];
let metadata: {
  regions: string[];
  provinces: string[];
  provinceToRegion: number[];
  statusLabels: string[];
} | null = null;

self.onmessage = function (e) {
  const { type, payload } = e.data;

  switch (type) {
    case 'load': {
      masterFeatures = payload.features || [];
      currentFeatures = masterFeatures;
      metadata = payload.metadata || null;

      supercluster = new (Supercluster as any)({
        radius: 60,
        maxZoom: 16,
        minZoom: 0,
        minPoints: 2,
        map: (props: any) => {
          const isRed = props.k === 2;
          const isAmber = props.k === 1;
          const isFlagged = (props.f || 0) > 0;
          return {
            totalBudget: (props.b || 0) * 1000,
            totalProjects: 1,
            flaggedCount: isFlagged ? 1 : 0,
            redCount: isRed ? 1 : 0,
            amberCount: isAmber ? 1 : 0,
            statusCounts: props.s !== undefined ? { [props.s]: 1 } : {},
            categoryCounts: props.c ? { [props.c]: 1 } : {},
          };
        },
        reduce: (accumulated: any, props: any) => {
          accumulated.totalBudget += props.totalBudget;
          accumulated.totalProjects += props.totalProjects;
          accumulated.flaggedCount += props.flaggedCount;
          accumulated.redCount += props.redCount;
          accumulated.amberCount += props.amberCount;

          if (props.statusCounts) {
            for (const s in props.statusCounts) {
              accumulated.statusCounts[s] = (accumulated.statusCounts[s] || 0) + props.statusCounts[s];
            }
          }

          if (props.categoryCounts) {
            for (const cat in props.categoryCounts) {
              accumulated.categoryCounts[cat] = (accumulated.categoryCounts[cat] || 0) + props.categoryCounts[cat];
            }
          }
        },
      });

      if (supercluster) {
        supercluster.load(currentFeatures);
      }
      self.postMessage({ type: 'ready', totalPoints: currentFeatures.length });
      break;
    }

    case 'getClusters': {
      if (!supercluster) return;
      const { bbox, zoom } = payload;
      const clusters = supercluster.getClusters(bbox, Math.floor(zoom));
      self.postMessage({ type: 'clusters', data: clusters });
      break;
    }

    case 'filter': {
      if (!masterFeatures || masterFeatures.length === 0) return;

      const { filters } = payload;

      let targetRegionIdx = -1;
      let targetProvinceIdx = -1;

      if (filters.region && metadata?.regions) {
        const regLower = filters.region.toLowerCase().trim();
        targetRegionIdx = metadata.regions.findIndex((r) => {
          const rl = r.toLowerCase().trim();
          return rl === regLower || rl.includes(regLower) || regLower.includes(rl);
        });
      }

      if (filters.province && metadata?.provinces) {
        const provLower = filters.province.toLowerCase().trim();
        targetProvinceIdx = metadata.provinces.findIndex((p) => {
          const pl = p.toLowerCase().trim();
          return pl === provLower || pl.includes(provLower) || provLower.includes(pl);
        });
      }

      currentFeatures = masterFeatures.filter((f: any) => {
        const p = f.properties;

        if (targetRegionIdx !== -1 && p.r !== targetRegionIdx) return false;
        if (targetProvinceIdx !== -1 && p.v !== targetProvinceIdx) return false;
        if (filters.category && p.c !== filters.category) return false;

        if (filters.flags && filters.flags.length > 0) {
          const fBit = p.f || 0;
          const matchFlags = filters.flags.some((flag: string) => {
            if (flag === 'flagOverpaid') return (fBit & 1) !== 0;
            if (flag === 'flagStalled') return (fBit & 2) !== 0;
            if (flag === 'flagNeverStarted') return (fBit & 4) !== 0;
            if (flag === 'flagOverdue') return (fBit & 8) !== 0;
            if (flag === 'flagPaymentPending') return (fBit & 16) !== 0;
            return false;
          });
          if (!matchFlags) return false;
        }

        return true;
      });

      if (supercluster) {
        supercluster.load(currentFeatures);
      }

      self.postMessage({ type: 'filtered', totalPoints: currentFeatures.length });
      break;
    }

    case 'getLeaves': {
      if (!supercluster) return;
      const { clusterId, limit, offset } = payload;
      const leaves = supercluster.getLeaves(clusterId, limit, offset);
      self.postMessage({ type: 'leaves', data: leaves });
      break;
    }

    case 'expansionZoom': {
      if (!supercluster) return;
      const { clusterId } = payload;
      const zoom = supercluster.getClusterExpansionZoom(clusterId);
      self.postMessage({ type: 'expansionZoom', zoom });
      break;
    }
  }
};
