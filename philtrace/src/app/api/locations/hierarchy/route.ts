import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'geo', 'full_location_hierarchy.json');

    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return Response.json(data);
    }

    return Response.json({ error: 'Hierarchy data not found' }, { status: 404 });
  } catch (error) {
    console.error('Error reading location hierarchy:', error);
    return Response.json({ error: 'Failed to fetch location hierarchy' }, { status: 500 });
  }
}
