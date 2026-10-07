import fs from 'fs';
import path from 'path';

const REGION_URLS = [
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-100000000.0.001.json",
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-1000000000.0.001.json",
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-1100000000.0.001.json",
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-1200000000.0.001.json",
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-1300000000.0.001.json",
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-1400000000.0.001.json",
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-1600000000.0.001.json",
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-1700000000.0.001.json",
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-1900000000.0.001.json",
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-200000000.0.001.json",
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-300000000.0.001.json",
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-400000000.0.001.json",
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-500000000.0.001.json",
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-600000000.0.001.json",
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-700000000.0.001.json",
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-800000000.0.001.json",
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/lowres/provdists-region-900000000.0.001.json"
];

async function run() {
  console.log("Fetching Faeldon 2023 province GeoJSON files...");
  const allFeatures = [];

  for (const url of REGION_URLS) {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Failed to fetch ${url}: ${res.statusText}`);
      continue;
    }
    const data = await res.json();
    if (data.features && Array.isArray(data.features)) {
      for (const feat of data.features) {
        // Normalize properties to match expected keys
        const provName = feat.properties?.adm2_en || feat.properties?.name || '';
        feat.properties = {
          ...feat.properties,
          name: provName,
          province_name: provName,
          PROVINCE: provName,
          psgcCode: feat.properties?.adm2_psgc ? String(feat.properties.adm2_psgc) : undefined,
        };
        allFeatures.push(feat);
      }
    }
  }

  const collection = {
    type: "FeatureCollection",
    features: allFeatures,
  };

  const outPath1 = path.join(process.cwd(), 'public', 'geo', 'provinces.json');
  const outPath2 = path.join(process.cwd(), 'public', 'data', 'ph-provinces.json');

  fs.writeFileSync(outPath1, JSON.stringify(collection));
  fs.writeFileSync(outPath2, JSON.stringify(collection));

  console.log(`Success! Combined ${allFeatures.length} official 2023 provinces into ${outPath1} and ${outPath2}`);
}

run().catch(console.error);
