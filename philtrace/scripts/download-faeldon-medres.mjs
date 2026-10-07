import fs from 'fs/promises';
import path from 'path';

async function run() {
  const geoDir = path.resolve('public', 'geo');
  const dataDir = path.resolve('public', 'data');
  await fs.mkdir(geoDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });

  console.log('Downloading regions (country.0.01.json)...');
  const countryRes = await fetch('https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/country/medres/country.0.01.json');
  const countryData = await countryRes.json();

  const regionsData = {
    ...countryData,
    features: countryData.features.map(feat => ({
      ...feat,
      properties: {
        ...feat.properties,
        name: feat.properties.adm1_en,
        region_name: feat.properties.adm1_en,
        REGION: feat.properties.adm1_en,
        psgcCode: feat.properties.adm1_psgc
      }
    }))
  };

  await fs.writeFile(path.join(geoDir, 'regions.json'), JSON.stringify(regionsData));
  await fs.writeFile(path.join(dataDir, 'ph-regions.json'), JSON.stringify(regionsData));

  const allProvincesFeatures = [];
  const regionPsgcs = countryData.features.map(f => f.properties.adm1_psgc);

  for (const psgc of regionPsgcs) {
    console.log(`Downloading provinces for region ${psgc}...`);
    try {
      const provRes = await fetch(`https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/medres/provdists-region-${psgc}.0.01.json`);
      if (provRes.ok) {
        const provData = await provRes.json();
        const features = provData.features.map(feat => ({
          ...feat,
          properties: {
            ...feat.properties,
            name: feat.properties.adm2_en,
            province_name: feat.properties.adm2_en,
            PROVINCE: feat.properties.adm2_en,
            psgcCode: feat.properties.adm2_psgc
          }
        }));
        allProvincesFeatures.push(...features);
      } else {
        console.error(`Failed to fetch region ${psgc}: ${provRes.statusText}`);
      }
    } catch (e) {
      console.error(`Error fetching region ${psgc}:`, e);
    }
  }

  const provincesData = {
    type: 'FeatureCollection',
    name: 'provinces',
    features: allProvincesFeatures
  };

  await fs.writeFile(path.join(geoDir, 'provinces.json'), JSON.stringify(provincesData));
  await fs.writeFile(path.join(dataDir, 'ph-provinces.json'), JSON.stringify(provincesData));

  console.log('Done!');
}

run().catch(console.error);
