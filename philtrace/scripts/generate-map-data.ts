import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Helper for ray-casting point in polygon
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
  return { minLng, minLat, maxLng, maxLat };
}

function cleanProjectTitle(raw: string): string {
  if (!raw) return 'DPWH Infrastructure Project';
  let s = raw.trim();

  // Strip generic bureaucratic program prefixes
  s = s.replace(/^(?:LOCAL|BASIC)\s+INFRASTRUCTURE\s+PROGRAM\s*(?:\([^)]+\))?\s*[:-]?\s*(?:BUILDINGS?\s+AND\s+OTHER\s+STRUCTURES\s*[:-]?\s*)?(?:MULTI[- ]?PURPOSE[/\w\s]*\s*[:-]?\s*)?/i, '');
  s = s.replace(/^(?:LOCAL|BASIC)\s+INFRASTRUCTURE\s+PROGRAM\s*(?:\([^)]+\))?\s*[:-]?\s*/i, '');
  s = s.replace(/^ORGANIZATIONAL\s+OUTCOME\s+\d+\s*[:-]\s*/i, '');
  s = s.replace(/^(?:ASSET\s+PRESERVATION|NETWORK\s+DEVELOPMENT|FLOOD\s+MANAGEMENT|CONVERGENCE\s+AND\s+SPECIAL\s+SUPPORT)\s*(?:PROGRAM|OF\s+NATIONAL\s+ROADS)?\s*[:-]\s*/i, '');
  s = s.replace(/^[-\s:]+/, '').trim();
  s = s.replace(/\s+/g, ' ');

  // If cleaning stripped everything, fall back to raw
  if (s.length < 5) s = raw.trim();

  return s.substring(0, 85).replace(/[\x00-\x1F\x7F]/g, ' ').trim();
}

async function main() {
  try {
    console.log('🚀 Starting SPATIALLY ACCURATE map data generation...');
    console.log('Aligning every project to its TRUE Region and Province via official GeoJSON boundary polygons!');
    console.log('');

    const geoDir = path.join(process.cwd(), 'public', 'geo');
    const provDir = path.join(geoDir, 'raw_province');
    const regDir = path.join(geoDir, 'raw_region');

    // ── Step 1: Load official regions & provinces ────────
    const hierarchyPath = path.join(geoDir, 'full_location_hierarchy.json');
    const hierarchy = JSON.parse(fs.readFileSync(hierarchyPath, 'utf8'));

    const regionLookup: string[] = [];
    const regionMap = new Map<string, number>();

    hierarchy.regions.forEach((r: any, i: number) => {
      regionLookup.push(r.name);
      regionMap.set(r.name.toLowerCase().trim(), i);
    });

    const provinceLookup: string[] = [];
    const provinceMap = new Map<string, number>();
    const provinceToRegion: number[] = [];

    // Load official 82 province polygons
    const provincePolygons: Array<{
      name: string;
      regionName: string;
      box: { minLng: number; minLat: number; maxLng: number; maxLat: number };
      geometry: any;
      provIdx: number;
      regIdx: number;
    }> = [];

    let pIdx = 0;
    hierarchy.regions.forEach((r: any, rIdx: number) => {
      r.provinces.forEach((p: any) => {
        provinceLookup.push(p.name);
        provinceMap.set(p.name.toLowerCase().trim(), pIdx);
        provinceToRegion.push(rIdx);
        pIdx++;
      });
    });

    const pFiles = fs.readdirSync(provDir);
    for (const f of pFiles) {
      if (!f.endsWith('.geo.json')) continue;
      const d = JSON.parse(fs.readFileSync(path.join(provDir, f), 'utf8'));
      const pName = d.properties?.province_name || '';
      const rName = d.properties?.region_name || '';
      const box = getBBox(d.geometry);

      const resolvedPIdx = provinceMap.get(pName.toLowerCase().trim()) ?? -1;
      const resolvedRIdx = regionMap.get(rName.toLowerCase().trim()) ?? -1;

      provincePolygons.push({
        name: pName,
        regionName: rName,
        box,
        geometry: d.geometry,
        provIdx: resolvedPIdx,
        regIdx: resolvedRIdx,
      });
    }

    console.log(`  📋 Loaded ${provincePolygons.length} official province polygons.`);
    console.log(`  📋 Standard Regions: ${regionLookup.length}, Standard Provinces: ${provinceLookup.length}`);

    // Helper to find exact province & region for coordinates [lng, lat]
    function findLocation(lng: number, lat: number): { provIdx: number; regIdx: number } {
      const candidates = provincePolygons.filter(
        (pv) =>
          lng >= pv.box.minLng &&
          lng <= pv.box.maxLng &&
          lat >= pv.box.minLat &&
          lat <= pv.box.maxLat
      );

      if (candidates.length === 1) {
        return { provIdx: candidates[0].provIdx, regIdx: candidates[0].regIdx };
      }

      if (candidates.length > 1) {
        const pt: [number, number] = [lng, lat];
        for (const cand of candidates) {
          if (pointInGeometry(pt, cand.geometry)) {
            return { provIdx: cand.provIdx, regIdx: cand.regIdx };
          }
        }
        return { provIdx: candidates[0].provIdx, regIdx: candidates[0].regIdx };
      }

      return { provIdx: -1, regIdx: -1 };
    }

    // ── Step 2: Query and process all projects ────────────
    const BATCH_SIZE = 15000;
    let totalProcessed = 0;
    let spatiallyCorrected = 0;
    const featureStrings: string[] = [];

    let cursorId: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const projects = await prisma.project.findMany({
        take: BATCH_SIZE,
        skip: cursorId ? 1 : 0,
        cursor: cursorId ? { id: cursorId } : undefined,
        orderBy: { id: 'asc' },
        select: {
          id: true,
          name: true,
          gpsLat: true,
          gpsLng: true,
          budgetPHP: true,
          progress: true,
          status: true,
          category: true,
          provinceId: true,
          flagOverpaid: true,
          flagStalled: true,
          flagNeverStarted: true,
          flagOverdue: true,
          flagPaymentPending: true,
          province: {
            select: {
              name: true,
              region: { select: { name: true } },
            },
          },
        },
      });

      if (projects.length === 0) {
        hasMore = false;
        break;
      }

      for (const p of projects) {
        const lng = p.gpsLng;
        const lat = p.gpsLat;
        if (!lng || !lat) continue;

        // SPATIAL RESOLUTION: Use real GPS coordinates to locate true Province & Region!
        let { provIdx, regIdx } = findLocation(lng, lat);

        // Fallback to database province if outside boundary (e.g. offshore coordinate)
        if (provIdx === -1 && p.province?.name) {
          provIdx = provinceMap.get(p.province.name.toLowerCase().trim()) ?? -1;
          regIdx = provIdx >= 0 ? provinceToRegion[provIdx] : -1;
        }

        // Status: 0=Completed, 1=Ongoing, 2=Not Yet Started, 3=Suspended, 4=Other
        const statusNum =
          p.status === 'Completed' ? 0 :
          p.status === 'Ongoing' ? 1 :
          p.status === 'Not Yet Started' ? 2 :
          p.status === 'Suspended' ? 3 : 4;

        // Category: shorten to first word or primary descriptor
        const cat = (p.category || '').split(' ')[0].substring(0, 12) || 'Other';

        // Flags as bitmask: bit0=overpaid, bit1=stalled, bit2=neverStarted, bit3=overdue, bit4=paymentPending
        let flags = 0;
        if (p.flagOverpaid) flags |= 1;
        if (p.flagStalled) flags |= 2;
        if (p.flagNeverStarted) flags |= 4;
        if (p.flagOverdue) flags |= 8;
        if (p.flagPaymentPending) flags |= 16;

        // Risk level: 2 = Red (overpaid / stalled), 1 = Amber (overdue / neverStarted / paymentPending), 0 = Normal
        let riskLevel = 0;
        if (p.flagOverpaid || p.flagStalled) {
          riskLevel = 2;
        } else if (p.flagOverdue || p.flagNeverStarted || p.flagPaymentPending) {
          riskLevel = 1;
        }

        // Round budget to nearest thousand (saves digits)
        const budgetK = Math.round((p.budgetPHP || 0) / 1000);

        // Meaningful, cleaned project title
        const cleanTitle = cleanProjectTitle(p.name);

        const props: Record<string, any> = {
          i: p.id,
          n: cleanTitle,
          b: budgetK,
          g: Math.round(p.progress || 0),
          s: statusNum,
          r: regIdx,
          v: provIdx,
        };

        if (riskLevel > 0) props.k = riskLevel;
        if (flags > 0) props.f = flags;
        if (cat !== 'Other') props.c = cat;

        featureStrings.push(
          `{"type":"Feature","geometry":{"type":"Point","coordinates":[${lng},${lat}]},"properties":${JSON.stringify(props)}}`
        );
      }

      totalProcessed += projects.length;
      cursorId = projects[projects.length - 1].id;
      console.log(`  📦 Processed ${totalProcessed.toLocaleString()} projects...`);
    }

    console.log('');
    console.log(`✅ Total projects processed: ${totalProcessed.toLocaleString()}`);

    // ── Step 3: Write GeoJSON ────────────────────────────
    const projectsFile = path.join(geoDir, 'all_projects.json');
    const writeStream = fs.createWriteStream(projectsFile);

    const metadata = {
      regions: regionLookup,
      provinces: provinceLookup,
      provinceToRegion: provinceToRegion,
      statusLabels: ['Completed', 'Ongoing', 'Not Yet Started', 'Suspended', 'Other'],
      totalProjects: totalProcessed,
      generatedAt: new Date().toISOString(),
    };

    writeStream.write(`{"type":"FeatureCollection","metadata":${JSON.stringify(metadata)},"features":[`);

    for (let i = 0; i < featureStrings.length; i++) {
      if (i > 0) writeStream.write(',');
      writeStream.write(featureStrings[i]);
    }

    writeStream.write(']}');
    writeStream.end();

    await new Promise<void>((resolve) => writeStream.on('finish', resolve));

    const stats = fs.statSync(projectsFile);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`  📁 Wrote all_projects.json — Size: ${sizeMB} MB`);
    console.log('🎉 Spatially accurate map data generated successfully!');
  } catch (error) {
    console.error('❌ Error generating map data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
