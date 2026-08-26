async function downloadPhRegions() {
  const url = "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2011/geojson/regions/medres/regions.0.01.json";
  console.log(`Downloading ${url}...`);
  const res = await fetch(url);
  if (res.ok) {
    const data = await res.json();
    console.log(`Downloaded successfully! Total region features: ${data.features?.length}`);
    for (const f of data.features) {
      console.log(`- ${f.properties?.REGION || f.properties?.NAME_1 || f.properties?.name || JSON.stringify(f.properties)}`);
    }
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.join(process.cwd(), 'public', 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ph-regions.json'), JSON.stringify(data));
    console.log("Saved to public/data/ph-regions.json");
  } else {
    console.log(`Failed: ${res.status}`);
  }
}
downloadPhRegions();
