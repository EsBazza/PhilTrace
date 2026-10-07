import fs from 'fs';
import path from 'path';

// World ring covering entire globe for inverted mask
const WORLD_RING: [number, number][] = [
  [-180, -90],
  [180, -90],
  [180, 90],
  [-180, 90],
  [-180, -90],
];

function getBBox(geometry: any) {
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
  traverse(geometry.coordinates);
  return [
    [+minLng.toFixed(5), +minLat.toFixed(5)],
    [+maxLng.toFixed(5), +maxLat.toFixed(5)],
  ] as [[number, number], [number, number]];
}

function createInvertedMask(geometry: any) {
  let holes: [number, number][][] = [];
  if (geometry.type === 'Polygon') {
    holes = [geometry.coordinates[0]];
  } else if (geometry.type === 'MultiPolygon') {
    holes = geometry.coordinates.map((poly: any) => poly[0]);
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [WORLD_RING, ...holes],
    },
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const name = searchParams.get('name') || '';
    const file = (searchParams.get('file') || '').replace(/[\/\\]/g, '');
    const cityFile = (searchParams.get('cityFile') || '').replace(/[\/\\]/g, '');

    const geoDir = path.join(process.cwd(), 'public', 'geo');
    let targetFilePath = '';
    let boundaryFeature: any = null;

    if (file) {
      const possibleDirs = ['raw_region', 'raw_province', 'raw_city', 'raw_barangay'];
      for (const d of possibleDirs) {
        const fp = path.join(geoDir, d, file);
        if (fs.existsSync(fp)) {
          targetFilePath = fp;
          break;
        }
      }
    } else if (type === 'region') {
      const p = path.join(geoDir, 'regions.json');
      if (fs.existsSync(p)) {
        const d = JSON.parse(fs.readFileSync(p, 'utf8'));
        const nameLower = name.toLowerCase().trim();
        const feat = d.features.find((f: any) => {
          const regName = (f.properties?.region_name || f.properties?.name || '').toLowerCase().trim();
          return regName === nameLower ||
            regName.includes(nameLower) ||
            nameLower.includes(regName) ||
            (nameLower.includes('ncr') && regName.includes('national capital')) ||
            (nameLower.includes('car') && !nameLower.includes('caraga') && regName.includes('cordillera')) ||
            (nameLower.includes('armm') && regName.includes('muslim')) ||
            (nameLower.includes('barmm') && regName.includes('muslim'));
        });
        if (feat) {
          boundaryFeature = feat;
        }
      }
    } else if (type === 'province') {
      const p = path.join(geoDir, 'provinces.json');
      if (fs.existsSync(p)) {
        const d = JSON.parse(fs.readFileSync(p, 'utf8'));
        const nameLower = name.toLowerCase().trim();
        const feat = d.features.find((f: any) => {
          const provName = (f.properties?.province_name || f.properties?.name || '').toLowerCase().trim();
          return provName === nameLower ||
            provName.includes(nameLower) ||
            nameLower.includes(provName) ||
            (nameLower.includes('manila') && provName.includes('manila'));
        });
        if (feat) {
          boundaryFeature = feat;
        }
      }
    } else if (type === 'city') {
      const cDir = path.join(geoDir, 'raw_city');
      if (fs.existsSync(cDir)) {
        const nameLower = name.toLowerCase().trim();

        if (cityFile && fs.existsSync(path.join(cDir, cityFile))) {
          targetFilePath = path.join(cDir, cityFile);
        } else {
          const files = fs.readdirSync(cDir);
          for (const f of files) {
            const d = JSON.parse(fs.readFileSync(path.join(cDir, f), 'utf8'));
            const cName = (d.properties?.city_name || '').toLowerCase().trim();
            if (cName === nameLower) {
              targetFilePath = path.join(cDir, f);
              break;
            }
          }
        }
      }
    } else if (type === 'barangay') {
      const bDir = path.join(geoDir, 'raw_barangay');
      if (fs.existsSync(bDir)) {
        const nameLower = name.toLowerCase().trim();
        const prefix = (cityFile || '').replace('.any.geo.json', '').replace('.geo.json', '');

        if (prefix) {
          const files = fs.readdirSync(bDir).filter((f) => f.startsWith(prefix));
          for (const f of files) {
            const d = JSON.parse(fs.readFileSync(path.join(bDir, f), 'utf8'));
            const bName = (d.properties?.barangay_name || '').toLowerCase().trim();
            if (bName === nameLower || f.toLowerCase().includes(nameLower.replace(/\s+/g, '-'))) {
              targetFilePath = path.join(bDir, f);
              break;
            }
          }
        }
      }
    }

    if (!boundaryFeature && targetFilePath && fs.existsSync(targetFilePath)) {
      boundaryFeature = JSON.parse(fs.readFileSync(targetFilePath, 'utf8'));
    }

    if (!boundaryFeature) {
      return Response.json({
        boundary: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [] } },
        mask: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [WORLD_RING] } },
        bounds: [[116, 4], [127, 21]],
        center: [121, 12],
      });
    }

    const bounds = getBBox(boundaryFeature.geometry);
    const center: [number, number] = [
      +((bounds[0][0] + bounds[1][0]) / 2).toFixed(5),
      +((bounds[0][1] + bounds[1][1]) / 2).toFixed(5),
    ];
    const mask = createInvertedMask(boundaryFeature.geometry);

    return Response.json(
      {
        boundary: boundaryFeature,
        mask,
        bounds,
        center,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      },
    );
  } catch (error) {
    console.error('Error serving boundary:', error);
    return Response.json({ error: 'Failed to fetch boundary' }, { status: 500 });
  }
}
