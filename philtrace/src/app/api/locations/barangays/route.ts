import fs from 'fs';
import path from 'path';

function normLocation(name: string) {
  return name
    .toLowerCase()
    .replace(/^city of\s+/i, '')
    .replace(/\s+city$/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function getBBox(geometry: any) {
  if (!geometry || !geometry.coordinates) return null;
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
  if (!isFinite(minLng) || !isFinite(minLat)) return null;
  return [
    [+minLng.toFixed(5), +minLat.toFixed(5)],
    [+maxLng.toFixed(5), +maxLat.toFixed(5)],
  ] as [[number, number], [number, number]];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cityFile = searchParams.get('cityFile') || searchParams.get('file');
    const municipality = searchParams.get('municipality') || '';
    const province = searchParams.get('province') || '';
    const cityPsgc = searchParams.get('cityPsgc') || '';

    const geoDir = path.join(process.cwd(), 'public', 'geo');
    const lookupPath = path.join(geoDir, '2023', 'muni_lookup.json');
    const muniPath = path.join(geoDir, 'municities.json');
    const provPath = path.join(geoDir, 'provinces.json');

    let muniPsgc = cityPsgc;
    let bgyData: any = null;

    // 1. If municipality and province provided, resolve exact province PSGC and match in municities.json
    if (!muniPsgc && municipality && province && fs.existsSync(provPath) && fs.existsSync(muniPath)) {
      try {
        const provData = JSON.parse(fs.readFileSync(provPath, 'utf8'));
        const normProv = normLocation(province);
        const pFeat = provData.features.find((f: any) => {
          const pName = normLocation(f.properties?.province_name || f.properties?.name || '');
          return pName === normProv || pName.includes(normProv) || normProv.includes(pName);
        });

        if (pFeat) {
          const targetProvPsgc = pFeat.properties?.adm2_psgc;
          const muniData = JSON.parse(fs.readFileSync(muniPath, 'utf8'));
          const normMuni = normLocation(municipality);

          const matchedMuni = muniData.features.find((f: any) => {
            const pPsgc = f.properties?.adm2_psgc || f.properties?.provincePsgc;
            if (String(pPsgc) !== String(targetProvPsgc)) return false;
            const mName = normLocation(f.properties?.name || f.properties?.adm3_en || f.properties?.city_name || '');
            return mName === normMuni;
          });

          if (matchedMuni?.properties?.adm3_psgc) {
            muniPsgc = String(matchedMuni.properties.adm3_psgc);
          }
        }
      } catch (e) {
        console.warn('Province disambiguation lookup error:', e);
      }
    }

    // 2. Fallback to muni_lookup.json if muniPsgc not resolved yet
    if (!muniPsgc && fs.existsSync(lookupPath)) {
      const lookup = JSON.parse(fs.readFileSync(lookupPath, 'utf8'));
      
      // If a municipality name is passed explicitly
      if (municipality) {
        const query = municipality.toLowerCase().trim();
        if (lookup[query]) muniPsgc = lookup[query].psgc;
      }
      
      // If we only have cityFile (e.g., from old drill-down), try to extract name
      if (!muniPsgc && cityFile) {
        const parts = cityFile.replace('.any.geo.json', '').replace('.geo.json', '').split('.');
        const muniPart = parts[parts.length - 1]; // e.g. "akbar"
        if (muniPart) {
           const query = muniPart.replace(/-/g, ' ').toLowerCase().trim();
           if (lookup[query]) muniPsgc = lookup[query].psgc;
           else {
             // Try to find any matching key
             const keys = Object.keys(lookup);
             for (const k of keys) {
               if (k === query || k.includes(query) || query.includes(k)) {
                 muniPsgc = lookup[k].psgc;
                 break;
               }
             }
           }
        }
      }
    }

    if (muniPsgc) {
      const bgyCache = path.join(geoDir, '2023', 'municities', `${muniPsgc}.json`);
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
    }

    // Fallback: check raw_barangay for HUCs or municipalities not in 2023 Faeldon
    if (!bgyData || !bgyData.features || bgyData.features.length === 0) {
      const rawBgyDir = path.join(geoDir, 'raw_barangay');
      if (fs.existsSync(rawBgyDir)) {
        let prefix = (cityFile || '').replace('.any.geo.json', '').replace('.geo.json', '');
        if (!prefix && municipality) {
          const rawCityDir = path.join(geoDir, 'raw_city');
          if (fs.existsSync(rawCityDir)) {
            const mClean = municipality
              .toLowerCase()
              .replace(/-/g, ' ')
              .replace(/^city of\s+/i, '')
              .replace(/\s+city$/i, '')
              .replace(/[^a-z0-9]/g, '')
              .trim();
            const cFiles = fs.readdirSync(rawCityDir);
            const found = cFiles.find((f) => {
              const base = f.replace('.any.geo.json', '').replace('.geo.json', '');
              const parts = base.split('.');
              const last = (parts[parts.length - 1] || '')
                .replace(/-/g, ' ')
                .replace(/^city of\s+/i, '')
                .replace(/\s+city$/i, '')
                .replace(/[^a-z0-9]/g, '')
                .trim();
              return last === mClean;
            });
            if (found) prefix = found.replace('.any.geo.json', '').replace('.geo.json', '');
          }
        }

        if (prefix) {
          const allBgy = fs.readdirSync(rawBgyDir).filter((f) => f.startsWith(prefix));
          if (allBgy.length > 0) {
            const feats = allBgy
              .map((f) => {
                try {
                  const d = JSON.parse(fs.readFileSync(path.join(rawBgyDir, f), 'utf8'));
                  return {
                    ...d,
                    properties: {
                      ...d.properties,
                      adm4_en: d.properties?.barangay_name || d.properties?.name,
                      adm4_psgc: d.properties?.barangay_id,
                    },
                  };
                } catch {
                  return null;
                }
              })
              .filter(Boolean);

            bgyData = {
              type: 'FeatureCollection',
              features: feats,
            };
          }
        }
      }
    }

    if (!bgyData || !bgyData.features) {
      return Response.json({ barangays: [], total: 0 });
    }

    const barangays = bgyData.features.map((f: any) => {
      const name = f.properties.adm4_en || f.properties.name || f.properties.barangay_name;
      return {
        name,
        psgcCode: f.properties.adm4_psgc || f.properties.barangay_id,
        bounds: getBBox(f.geometry),
      };
    });

    // Sort alphabetically
    barangays.sort((a: any, b: any) => a.name.localeCompare(b.name));

    return Response.json(
      { barangays, geojson: bgyData, total: barangays.length },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      },
    );
  } catch (error) {
    console.error('Error fetching barangays:', error);
    return Response.json({ error: 'Failed to fetch barangays' }, { status: 500 });
  }
}
