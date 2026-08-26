async function searchHF() {
  const mirrors = [
    "bettergovph/dpwh-transparency-data",
    "c4rv3r/dpwh-transparency-data",
    "TEMSY001/dpwh-transparency-data"
  ];

  for (const m of mirrors) {
    try {
      const res = await fetch(`https://datasets-server.huggingface.co/first-rows?dataset=${encodeURIComponent(m)}&config=default&split=train`);
      console.log(`Mirror: ${m} -> Status ${res.status}`);
      if (res.ok) {
        const d = await res.json();
        console.log(`  -> Available features:`, d.features?.map(f => f.name).join(", "));
        console.log(`  -> Rows count in chunk: ${d.rows?.length}`);
      }
    } catch (e) {
      console.log(`Mirror: ${m} -> Failed:`, e.message);
    }
  }
}

searchHF();
