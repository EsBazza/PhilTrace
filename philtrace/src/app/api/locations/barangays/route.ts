import fs from 'fs';
import path from 'path';

let cachedBarangays: Record<string, string[]> | null = null;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cityFile = searchParams.get('cityFile') || searchParams.get('file');

    if (!cachedBarangays) {
      const filePath = path.join(process.cwd(), 'public', 'geo', 'city_barangays.json');
      if (fs.existsSync(filePath)) {
        cachedBarangays = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } else {
        cachedBarangays = {};
      }
    }

    if (!cityFile) {
      return Response.json({ error: 'Missing cityFile parameter' }, { status: 400 });
    }

    // cityFile can be e.g. "ph.autonomous-region-of-muslim-mindanao-armm.basilan.akbar.any.geo.json"
    const prefix = cityFile.replace('.any.geo.json', '').replace('.geo.json', '');

    const dict = cachedBarangays || {};
    const barangays = dict[prefix] || [];

    return Response.json(
      { barangays, total: barangays.length },
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
