import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cityFile = searchParams.get('cityFile') || searchParams.get('file');
    const municipality = searchParams.get('municipality') || '';
    const cityPsgc = searchParams.get('cityPsgc') || '';

    const geoDir = path.join(process.cwd(), 'public', 'geo');
    const lookupPath = path.join(geoDir, '2023', 'muni_lookup.json');
    let muniPsgc = cityPsgc;

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

    if (!muniPsgc) {
      return Response.json({ error: 'Could not resolve municipality PSGC' }, { status: 404 });
    }

    const bgyCache = path.join(geoDir, '2023', 'municities', `${muniPsgc}.json`);
    let bgyData = null;

    if (fs.existsSync(bgyCache)) {
      bgyData = JSON.parse(fs.readFileSync(bgyCache, 'utf8'));
    } else {
      const res = await fetch(`https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/municities/medres/bgysubmuns-municity-${muniPsgc}.0.01.json`);
      if (res.ok) {
        bgyData = await res.json();
        // ensure dir exists
        const dir = path.dirname(bgyCache);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(bgyCache, JSON.stringify(bgyData));
      }
    }

    if (!bgyData || !bgyData.features) {
      return Response.json({ barangays: [], total: 0 });
    }

    const barangays = bgyData.features.map((f: any) => {
      const name = f.properties.adm4_en || f.properties.name;
      return {
        name,
        psgcCode: f.properties.adm4_psgc,
        bounds: null, // Legacy compatibility if needed
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
