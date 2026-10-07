import fs from 'fs/promises';
import path from 'path';

async function run() {
  const geoDir = path.resolve('public', 'geo');
  const provdistsDir = path.join(geoDir, '2023', 'provdists');
  const municitiesCacheDir = path.join(geoDir, '2023', 'municities');
  await fs.mkdir(provdistsDir, { recursive: true });
  await fs.mkdir(municitiesCacheDir, { recursive: true });

  const provincesPath = path.join(geoDir, 'provinces.json');
  const provincesData = JSON.parse(await fs.readFile(provincesPath, 'utf8'));

  const adm2_psgcs = provincesData.features.map(f => f.properties.adm2_psgc).filter(Boolean);

  const allMunicitiesFeatures = [];
  const muniLookup = {};

  for (const psgc of adm2_psgcs) {
    console.log(`Fetching municities for province ${psgc}...`);
    try {
      const res = await fetch(`https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/provdists/medres/municities-provdist-${psgc}.0.01.json`);
      if (res.ok) {
        const data = await res.json();
        const features = data.features.map(f => {
          const name = f.properties.adm3_en;
          const adm3_psgc = f.properties.adm3_psgc;
          const adm2_psgc = f.properties.adm2_psgc;
          return {
            ...f,
            properties: {
              ...f.properties,
              name,
              municipality_name: name,
              city_name: name,
              psgcCode: adm3_psgc,
              provincePsgc: adm2_psgc
            }
          };
        });

        await fs.writeFile(path.join(provdistsDir, `${psgc}.json`), JSON.stringify({
          type: 'FeatureCollection',
          features
        }));

        allMunicitiesFeatures.push(...features);

        for (const feat of features) {
          const nameLower = feat.properties.name.toLowerCase().trim();
          muniLookup[nameLower] = {
            psgc: feat.properties.psgcCode,
            name: feat.properties.name,
            provincePsgc: feat.properties.provincePsgc
          };
        }
      } else {
        console.error(`Failed for province ${psgc}: ${res.statusText}`);
      }
    } catch (err) {
      console.error(`Error for province ${psgc}:`, err);
    }
  }

  await fs.writeFile(path.join(geoDir, 'municities.json'), JSON.stringify({
    type: 'FeatureCollection',
    features: allMunicitiesFeatures
  }));

  await fs.writeFile(path.join(geoDir, '2023', 'muni_lookup.json'), JSON.stringify(muniLookup));
  console.log('Done downloading municities!');
}

run().catch(console.error);
