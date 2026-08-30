import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const geoDir = path.join(__dirname, '..', 'public', 'geo');
const rawRegionDir = path.join(geoDir, 'raw_region');
const rawProvinceDir = path.join(geoDir, 'raw_province');
const rawCityDir = path.join(geoDir, 'raw_city');

console.log('Combining GeoJSON regions...');
const regionFiles = fs.readdirSync(rawRegionDir).filter(f => f.endsWith('.json'));
const regionFeatures = [];

for (const file of regionFiles) {
  try {
    const content = JSON.parse(fs.readFileSync(path.join(rawRegionDir, file), 'utf8'));
    if (content.type === 'Feature') {
      regionFeatures.push(content);
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err.message);
  }
}

fs.writeFileSync(
  path.join(geoDir, 'regions.json'),
  JSON.stringify({ type: 'FeatureCollection', features: regionFeatures })
);
console.log(`Generated regions.json with ${regionFeatures.length} features`);

console.log('Combining GeoJSON provinces...');
const provinceFiles = fs.readdirSync(rawProvinceDir).filter(f => f.endsWith('.json'));
const provinceFeatures = [];

for (const file of provinceFiles) {
  try {
    const content = JSON.parse(fs.readFileSync(path.join(rawProvinceDir, file), 'utf8'));
    if (content.type === 'Feature') {
      provinceFeatures.push(content);
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err.message);
  }
}

fs.writeFileSync(
  path.join(geoDir, 'provinces.json'),
  JSON.stringify({ type: 'FeatureCollection', features: provinceFeatures })
);
console.log(`Generated provinces.json with ${provinceFeatures.length} features`);
