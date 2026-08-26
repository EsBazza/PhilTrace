async function findGeojson() {
  try {
    const res = await fetch("https://api.github.com/repos/faeldon/philippines-json-maps/git/trees/master?recursive=1");
    if (res.ok) {
      const data = await res.json();
      const files = data.tree?.filter(t => t.path.includes("region") && t.path.endsWith(".json"));
      console.log("Region files in faeldon/philippines-json-maps:", files.map(f => f.path));
      if (files.length > 0) {
        const fileRes = await fetch(`https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/${files[0].path}`);
        if (fileRes.ok) {
          const geo = await fileRes.json();
          const fs = await import('fs');
          const path = await import('path');
          const dir = path.join(process.cwd(), 'public', 'data');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, 'ph-regions.json'), JSON.stringify(geo));
          console.log(`Saved ${files[0].path} to public/data/ph-regions.json!`);
        }
      }
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}
findGeojson();
