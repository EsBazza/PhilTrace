async function searchGeo() {
  const urls = [
    "https://raw.githubusercontent.com/macoymejia/geojson-philippines/master/regions/regions.json",
    "https://raw.githubusercontent.com/altcoder/philippines-region-geojson/master/philippines_regions.geojson",
    "https://raw.githubusercontent.com/geohacker/philippines/master/geojson/regions.geojson",
    "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/geojson/regions/lowres/regions.0.1.json"
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      console.log(`URL: ${url} -> ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`  Features: ${data.features?.length}`);
        const fs = await import('fs');
        const path = await import('path');
        const dir = path.join(process.cwd(), 'public', 'data');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'ph-regions.json'), JSON.stringify(data));
        console.log("Saved to public/data/ph-regions.json");
        break;
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
}

searchGeo();
