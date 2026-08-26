async function fetchPhGeo() {
  const url = "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/geojson/regions/hires/regions.0.01.json";
  console.log("Fetching Philippine Regions GeoJSON...");
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      console.log(`Successfully fetched GeoJSON! Total features: ${data.features?.length}`);
      
      const fs = await import('fs');
      const path = await import('path');
      const dir = path.join(process.cwd(), 'public', 'data');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'ph-regions.json'), JSON.stringify(data));
      console.log("Saved to public/data/ph-regions.json");
    } else {
      console.log(`Failed: ${res.status}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

fetchPhGeo();
