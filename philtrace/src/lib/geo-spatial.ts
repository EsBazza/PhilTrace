import fs from 'fs';
import path from 'path';

function pointInPolygon(point: [number, number], vs: number[][]) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInGeometry(point: [number, number], geometry: any): boolean {
  if (geometry.type === 'Polygon') {
    return pointInPolygon(point, geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      if (pointInPolygon(point, poly[0])) return true;
    }
  }
  return false;
}

interface SpatialProvince {
  province: string;
  region: string;
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  geometry: any;
}

let cachedProvinces: SpatialProvince[] | null = null;

function loadProvinces(): SpatialProvince[] {
  if (cachedProvinces) return cachedProvinces;

  try {
    const filePath = path.join(process.cwd(), 'public', 'geo', 'spatial_province_polygons.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      cachedProvinces = data.map((item: any) => {
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        function traverse(coords: any) {
          if (typeof coords[0] === 'number') {
            const [lng, lat] = coords;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          } else {
            for (const c of coords) traverse(c);
          }
        }
        traverse(item.geometry.coordinates);

        return {
          province: item.province,
          region: item.region,
          bbox: { minLng, minLat, maxLng, maxLat },
          geometry: item.geometry,
        };
      });
      return cachedProvinces || [];
    }
  } catch (err) {
    console.error('Failed to load spatial province polygons:', err);
  }
  return [];
}

export function resolveProvinceAndRegion(lng: number, lat: number): { province: string; region: string } | null {
  if (!lng || !lat) return null;
  const provinces = loadProvinces();
  if (provinces.length === 0) return null;

  const candidates = provinces.filter(
    (p) =>
      lng >= p.bbox.minLng &&
      lng <= p.bbox.maxLng &&
      lat >= p.bbox.minLat &&
      lat <= p.bbox.maxLat
  );

  if (candidates.length === 1) {
    return { province: candidates[0].province, region: candidates[0].region };
  }

  if (candidates.length > 1) {
    const pt: [number, number] = [lng, lat];
    for (const cand of candidates) {
      if (pointInGeometry(pt, cand.geometry)) {
        return { province: cand.province, region: cand.region };
      }
    }
    return { province: candidates[0].province, region: candidates[0].region };
  }

  return null;
}
