async function inspectHfFiles() {
  const datasets = [
    "bettergovph/dpwh-transparency-data",
    "c4rv3r/dpwh-transparency-data",
    "TEMSY001/dpwh-transparency-data"
  ];

  for (const ds of datasets) {
    try {
      const res = await fetch(`https://huggingface.co/api/datasets/${ds}/tree/main`);
      if (res.ok) {
        const files = await res.json();
        console.log(`\nFiles in ${ds}:`);
        for (const f of files) {
          console.log(`  - ${f.path} (${(f.size / 1024 / 1024).toFixed(2)} MB, type: ${f.type})`);
        }
      }
    } catch (e) {
      console.log(`Error checking ${ds}: ${e.message}`);
    }
  }
}

inspectHfFiles();
