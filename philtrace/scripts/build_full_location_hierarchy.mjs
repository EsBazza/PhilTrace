import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const geoDir = path.join(__dirname, '..', 'public', 'geo');
const rawCityDir = path.join(geoDir, 'raw_city');

console.log('Extracting all cities & municipalities across the Philippines from raw GeoJSON assets...');

const files = fs.readdirSync(rawCityDir).filter(f => f.endsWith('.json'));
console.log(`Found ${files.length} city/municipality GeoJSON files.`);

const regionMap = new Map();

for (const file of files) {
  try {
    const raw = fs.readFileSync(path.join(rawCityDir, file), 'utf8');
    const json = JSON.parse(raw);
    const props = json.properties || {};

    const regionName = props.region_name || 'Other Region';
    const provinceName = props.province_name || 'Independent';
    const cityName = props.city_name || props.name;
    const cityId = props.city_id || props.city_reference || file;

    if (!cityName) continue;

    if (!regionMap.has(regionName)) {
      regionMap.set(regionName, {
        id: `reg-${regionName}`,
        name: regionName,
        provinces: new Map(),
      });
    }

    const reg = regionMap.get(regionName);
    if (!reg.provinces.has(provinceName)) {
      reg.provinces.set(provinceName, {
        id: `prov-${provinceName}`,
        name: provinceName,
        cities: [],
      });
    }

    const prov = reg.provinces.get(provinceName);
    if (!prov.cities.some(c => c.name === cityName)) {
      prov.cities.push({
        id: String(cityId),
        name: cityName,
        file: file,
      });
    }
  } catch (err) {
    console.error(`Error parsing ${file}:`, err.message);
  }
}

// Convert maps to sorted arrays
const regions = Array.from(regionMap.values())
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(reg => ({
    id: reg.id,
    name: reg.name,
    provinces: Array.from(reg.provinces.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(prov => ({
        id: prov.id,
        name: prov.name,
        cities: prov.cities.sort((a, b) => a.name.localeCompare(b.name)),
      })),
  }));

const totalProvinces = regions.reduce((sum, r) => sum + r.provinces.length, 0);
const totalCities = regions.reduce((sum, r) => sum + r.provinces.reduce((cSum, p) => cSum + p.cities.length, 0), 0);

const outputPath = path.join(geoDir, 'full_location_hierarchy.json');
fs.writeFileSync(outputPath, JSON.stringify({ regions, totalRegions: regions.length, totalProvinces, totalCities }, null, 2));

console.log(`✅ Successfully generated full location hierarchy:`);
console.log(`   - ${regions.length} Regions`);
console.log(`   - ${totalProvinces} Provinces`);
console.log(`   - ${totalCities} Cities & Municipalities`);
console.log(`   - Saved to: ${outputPath}`);
