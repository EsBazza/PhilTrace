import fs from 'fs';
import path from 'path';

function getBBox(geometry: any) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

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

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  const maxSpan = Math.max(latSpan, lngSpan);

  let zoom = 10;
  if (maxSpan > 5) zoom = 6.5;
  else if (maxSpan > 3) zoom = 7.5;
  else if (maxSpan > 1.8) zoom = 8.5;
  else if (maxSpan > 0.8) zoom = 9.5;
  else if (maxSpan > 0.35) zoom = 11;
  else if (maxSpan > 0.15) zoom = 12;
  else if (maxSpan > 0.05) zoom = 13.5;
  else zoom = 14.5;

  return {
    bounds: [
      [+minLng.toFixed(5), +minLat.toFixed(5)],
      [+maxLng.toFixed(5), +maxLat.toFixed(5)],
    ] as [[number, number], [number, number]],
    center: [
      +((minLng + maxLng) / 2).toFixed(5),
      +((minLat + maxLat) / 2).toFixed(5),
    ] as [number, number],
    zoom,
  };
}

async function main() {
  console.log('🗺️ Generating REAL location centroids and bounds from official GeoJSON boundaries...');
  console.log('');

  const geoDir = path.join(process.cwd(), 'public', 'geo');
  const regDir = path.join(geoDir, 'raw_region');
  const provDir = path.join(geoDir, 'raw_province');
  const cityDir = path.join(geoDir, 'raw_city');
  const brgyDir = path.join(geoDir, 'raw_barangay');

  const hierarchyPath = path.join(geoDir, 'full_location_hierarchy.json');
  const hierarchy = JSON.parse(fs.readFileSync(hierarchyPath, 'utf8'));

  const centroids: {
    regions: Record<string, any>;
    provinces: Record<string, any>;
    cities: Record<string, any>;
  } = {
    regions: {},
    provinces: {},
    cities: {},
  };

  // ── 1. REGIONS ─────────────────────────────────────────
  console.log('📍 Processing 17 Regions...');
  const regFiles = fs.readdirSync(regDir);
  for (const f of regFiles) {
    if (!f.endsWith('.geo.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(regDir, f), 'utf8'));
    const bbox = getBBox(d.geometry);
    const regName = d.properties.region_name;

    centroids.regions[regName] = bbox;
    centroids.regions[regName.toLowerCase().trim()] = bbox;

    // Also add aliases
    if (regName.includes('National Capital Region')) {
      centroids.regions['NCR'] = bbox;
      centroids.regions['National Capital Region (NCR)'] = bbox;
    }
    if (regName.includes('Cordillera')) {
      centroids.regions['CAR'] = bbox;
      centroids.regions['Cordillera Administrative Region (CAR)'] = bbox;
    }
    if (regName.includes('Muslim Mindanao')) {
      centroids.regions['BARMM'] = bbox;
      centroids.regions['ARMM'] = bbox;
      centroids.regions['Autonomous Region of Muslim Mindanao (ARMM)'] = bbox;
      centroids.regions['Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)'] = bbox;
    }
    // Match Roman numerals (e.g. "Region I", "Region IV-A")
    const match = regName.match(/Region\s+([IVXLCDM]+(?:-[AB])?)/i);
    if (match) {
      centroids.regions[match[0]] = bbox;
      centroids.regions[match[0].toLowerCase()] = bbox;
    }
  }

  // Ensure hierarchy region names match exactly
  for (const r of hierarchy.regions) {
    if (!centroids.regions[r.name]) {
      // Find fuzzy
      for (const [k, v] of Object.entries(centroids.regions)) {
        if (k.toLowerCase().includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(k.toLowerCase())) {
          centroids.regions[r.name] = v;
          break;
        }
      }
    }
  }

  console.log(`  ✅ Regions indexed: ${Object.keys(centroids.regions).length} keys`);

  // ── 2. PROVINCES ───────────────────────────────────────
  console.log('📍 Processing 82 Provinces...');
  const provFiles = fs.readdirSync(provDir);
  for (const f of provFiles) {
    if (!f.endsWith('.geo.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(provDir, f), 'utf8'));
    const bbox = getBBox(d.geometry);
    const pName = d.properties.province_name;
    const rName = d.properties.region_name;

    centroids.provinces[pName] = bbox;
    centroids.provinces[pName.toLowerCase().trim()] = bbox;
    centroids.provinces[`${rName}::${pName}`] = bbox;

    // Special case aliases
    if (pName === 'Metropolitan Manila') {
      centroids.provinces['Metro Manila'] = bbox;
      centroids.provinces['metropolitan manila'] = bbox;
      centroids.provinces['metro manila'] = bbox;
    }
  }

  // Ensure hierarchy province names match
  for (const r of hierarchy.regions) {
    for (const p of r.provinces) {
      if (!centroids.provinces[p.name]) {
        for (const [k, v] of Object.entries(centroids.provinces)) {
          if (k.toLowerCase().trim() === p.name.toLowerCase().trim()) {
            centroids.provinces[p.name] = v;
            break;
          }
        }
      }
    }
  }

  console.log(`  ✅ Provinces indexed: ${Object.keys(centroids.provinces).length} keys`);

  // ── 3. CITIES ──────────────────────────────────────────
  console.log('📍 Processing 1,644 Cities / Municipalities...');
  const cityFiles = fs.readdirSync(cityDir);
  for (const f of cityFiles) {
    if (!f.endsWith('.geo.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(cityDir, f), 'utf8'));
    const bbox = getBBox(d.geometry);
    const cName = d.properties.city_name;
    const pName = d.properties.province_name;

    centroids.cities[cName] = bbox;
    centroids.cities[cName.toLowerCase().trim()] = bbox;
    centroids.cities[`${pName}::${cName}`] = bbox;
    centroids.cities[f] = bbox; // by filename as well
  }

  // Also index directly from hierarchy entries
  for (const r of hierarchy.regions) {
    for (const p of r.provinces) {
      for (const c of p.cities) {
        if (!centroids.cities[c.name]) {
          const fileKey = c.file;
          if (fileKey && centroids.cities[fileKey]) {
            centroids.cities[c.name] = centroids.cities[fileKey];
          }
        }
      }
    }
  }

  console.log(`  ✅ Cities indexed: ${Object.keys(centroids.cities).length} keys`);

  // Write region_centroids.json
  const centroidsFile = path.join(geoDir, 'region_centroids.json');
  fs.writeFileSync(centroidsFile, JSON.stringify(centroids, null, 2));
  const cStats = fs.statSync(centroidsFile);
  console.log(`  📁 Wrote region_centroids.json — Size: ${(cStats.size / 1024).toFixed(1)} KB`);

  // ── 4. BARANGAYS ───────────────────────────────────────
  console.log('📍 Processing 41,743 Barangays from raw_barangay...');
  const brgyFiles = fs.readdirSync(brgyDir);
  const cityBarangays: Record<
    string,
    Array<{
      name: string;
      bounds: [[number, number], [number, number]];
      center: [number, number];
      zoom: number;
    }>
  > = {};

  let count = 0;
  for (const f of brgyFiles) {
    if (!f.endsWith('.geo.json')) continue;
    const parts = f.replace('.geo.json', '').split('.');
    if (parts.length < 5) continue;

    const cityPrefix = parts.slice(0, -1).join('.');
    const d = JSON.parse(fs.readFileSync(path.join(brgyDir, f), 'utf8'));
    const bbox = getBBox(d.geometry);

    const bName =
      d.properties?.barangay_name ||
      parts[parts.length - 1]
        .split('-')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    if (!cityBarangays[cityPrefix]) {
      cityBarangays[cityPrefix] = [];
    }

    cityBarangays[cityPrefix].push({
      name: bName,
      bounds: bbox.bounds,
      center: bbox.center,
      zoom: Math.max(bbox.zoom, 14),
    });

    count++;
    if (count % 10000 === 0) {
      console.log(`  📦 Processed ${count.toLocaleString()} barangays...`);
    }
  }

  console.log(`  ✅ Total barangays processed: ${count.toLocaleString()}`);

  // Sort barangays inside each city alphabetically
  for (const list of Object.values(cityBarangays)) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const brgyOutFile = path.join(geoDir, 'city_barangays.json');
  fs.writeFileSync(brgyOutFile, JSON.stringify(cityBarangays));
  const bStats = fs.statSync(brgyOutFile);
  console.log(`  📁 Wrote city_barangays.json — Size: ${(bStats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log('');
  console.log('🎉 REAL geographic boundaries, centers, and zooms generated successfully!');
}

main().catch(console.error);
