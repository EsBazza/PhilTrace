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
    const municipality = (searchParams.get('municipality') || '').trim();
    const province = (searchParams.get('province') || '').trim();

    const geoDir = path.join(process.cwd(), 'public', 'geo');
    let targetFilePath = '';
    let boundaryFeature: any = null;

    const normLocation = (s: string) => {
      return (s || '')
        .toLowerCase()
        .replace(/-/g, ' ')
        .replace(/^city of\s+/i, '')
        .replace(/\s+city$/i, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
    };

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
    } else if (type === 'city' || type === 'municipality') {
      const muniPath = path.join(geoDir, 'municities.json');
      const provPath = path.join(geoDir, 'provinces.json');
      const normTarget = normLocation(name);

      // 1. Resolve province PSGC if province parameter is provided
      let targetProvPsgc: string | number | null = null;
      if (province && fs.existsSync(provPath)) {
        const provData = JSON.parse(fs.readFileSync(provPath, 'utf8'));
        const normProv = normLocation(province);
        const pFeat = provData.features.find((f: any) => {
          const pName = normLocation(f.properties?.province_name || f.properties?.name || '');
          return pName === normProv || pName.includes(normProv) || normProv.includes(pName);
        });
        if (pFeat) {
          targetProvPsgc = pFeat.properties?.adm2_psgc;
        }
      }

      // 2. Search in municities.json with province priority
      if (fs.existsSync(muniPath)) {
        const d = JSON.parse(fs.readFileSync(muniPath, 'utf8'));
        
        // Priority 2a: Exact name match within specified province
        if (targetProvPsgc) {
          const provMatch = d.features.find((f: any) => {
            const pPsgc = f.properties?.adm2_psgc || f.properties?.provincePsgc;
            if (String(pPsgc) !== String(targetProvPsgc)) return false;
            const mName = normLocation(f.properties?.name || f.properties?.adm3_en || f.properties?.city_name || '');
            return mName === normTarget;
          });
          if (provMatch) boundaryFeature = provMatch;
        }

        // Priority 2b: Exact normalized name match across all features in municities.json
        if (!boundaryFeature) {
          const exactMatch = d.features.find((f: any) => {
            const mName = normLocation(f.properties?.name || f.properties?.adm3_en || f.properties?.city_name || '');
            return mName === normTarget;
          });
          if (exactMatch) boundaryFeature = exactMatch;
        }
      }

      // Priority 2c: Exact match in raw_city for Highly Urbanized Cities (Cebu City, Baguio City, Iloilo City, etc.)
      if (!boundaryFeature) {
        const rawCityDir = path.join(geoDir, 'raw_city');
        if (fs.existsSync(rawCityDir)) {
          if (cityFile && fs.existsSync(path.join(rawCityDir, cityFile))) {
            targetFilePath = path.join(rawCityDir, cityFile);
          } else {
            const files = fs.readdirSync(rawCityDir);
            const matchedFile = files.find((f) => {
              const base = f.replace('.any.geo.json', '').replace('.geo.json', '');
              const parts = base.split('.');
              const cName = parts[parts.length - 1] || '';
              return normLocation(cName) === normTarget;
            });
            if (matchedFile) {
              targetFilePath = path.join(rawCityDir, matchedFile);
            }
          }
        }
      }

      // Priority 2d: Substring match fallback in municities.json
      if (!boundaryFeature && !targetFilePath && fs.existsSync(muniPath)) {
        const d = JSON.parse(fs.readFileSync(muniPath, 'utf8'));
        const subMatch = d.features.find((f: any) => {
          const mName = normLocation(f.properties?.name || f.properties?.adm3_en || f.properties?.city_name || '');
          return mName.includes(normTarget) || normTarget.includes(mName);
        });
        if (subMatch) boundaryFeature = subMatch;
      }
    } else if (type === 'barangay') {
      const lookupPath = path.join(geoDir, '2023', 'muni_lookup.json');
      let muniPsgc = '';
      const normBgyTarget = normLocation(name);

      if (fs.existsSync(lookupPath)) {
        const lookup = JSON.parse(fs.readFileSync(lookupPath, 'utf8'));
        const mKey = (municipality || cityFile || '').replace(/[\.\-]/g, ' ').toLowerCase().trim();
        if (lookup[mKey]) {
          muniPsgc = lookup[mKey].psgc;
        } else {
          for (const k of Object.keys(lookup)) {
            if (mKey && (mKey.includes(k) || k.includes(mKey))) {
              muniPsgc = lookup[k].psgc;
              break;
            }
          }
        }
      }

      // Try 2023 Faeldon barangays first
      if (muniPsgc) {
        const bgyCache = path.join(geoDir, '2023', 'municities', `${muniPsgc}.json`);
        let bgyData = null;
        if (fs.existsSync(bgyCache)) {
          bgyData = JSON.parse(fs.readFileSync(bgyCache, 'utf8'));
        } else {
          try {
            const res = await fetch(`https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/municities/medres/bgysubmuns-municity-${muniPsgc}.0.01.json`);
            if (res.ok) {
              bgyData = await res.json();
              const dir = path.dirname(bgyCache);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(bgyCache, JSON.stringify(bgyData));
            }
          } catch {}
        }

        if (bgyData?.features) {
          const feat = bgyData.features.find((f: any) => {
            const bName = normLocation(f.properties?.adm4_en || f.properties?.name || '');
            return bName === normBgyTarget || bName.includes(normBgyTarget) || normBgyTarget.includes(bName);
          });
          if (feat) {
            boundaryFeature = feat;
          }
        }
      }

      // Fallback: raw_barangay directory
      if (!boundaryFeature) {
        const rawBgyDir = path.join(geoDir, 'raw_barangay');
        if (fs.existsSync(rawBgyDir)) {
          const muniSlug = (municipality || cityFile || '')
            .toLowerCase()
            .replace(/^city of\s+/i, '')
            .replace(/\s+city$/i, '')
            .replace(/[^a-z0-9]/g, '-');

          const files = fs.readdirSync(rawBgyDir);
          const matchedFile = files.find((f) => {
            const fLower = f.toLowerCase();
            const matchesMuni = !muniSlug || fLower.includes(muniSlug);
            const matchesBgy = fLower.includes(name.toLowerCase().replace(/[^a-z0-9]/g, '-'));
            return matchesMuni && matchesBgy;
          });

          if (matchedFile) {
            targetFilePath = path.join(rawBgyDir, matchedFile);
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
