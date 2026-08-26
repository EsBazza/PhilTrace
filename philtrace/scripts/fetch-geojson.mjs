async function fetchGeo() {
  const urls = [
    "https://raw.githubusercontent.com/macoymejia/geojsonph/master/Region/Regions.json",
    "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/geojson/regions/regions.default.geojson",
    "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2019/geojson/regions/lowres/regions.0.1.json"
  ];

  for (const u of urls) {
    try {
      const res = await fetch(u);
      console.log(`${u} -> ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`Success! Features: ${data.features?.length}`);
        const fs = await import('fs');
        const path = await import('path');
        const dir = path.join(process.cwd(), 'public', 'data');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'ph-regions.json'), JSON.stringify(data));
        console.log("Saved to public/data/ph-regions.json");
        break;
      }
    } catch (e) {
      console.log(`Failed: ${e.message}`);
    }
  }
}

fetchGeo();
