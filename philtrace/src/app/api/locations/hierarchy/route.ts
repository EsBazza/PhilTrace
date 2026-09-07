import fs from 'fs';
import path from 'path';

let cachedHierarchy: unknown = null;

export async function GET() {
  try {
    if (cachedHierarchy) {
      return Response.json(cachedHierarchy, {
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    }

    const filePath = path.join(process.cwd(), 'public', 'geo', 'full_location_hierarchy.json');

    if (fs.existsSync(filePath)) {
      cachedHierarchy = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return Response.json(cachedHierarchy, {
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    }

    return Response.json({ error: 'Hierarchy data not found' }, { status: 404 });
  } catch (error) {
    console.error('Error reading location hierarchy:', error);
    return Response.json({ error: 'Failed to fetch location hierarchy' }, { status: 500 });
  }
}
