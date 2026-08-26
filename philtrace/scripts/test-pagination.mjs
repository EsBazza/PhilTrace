async function testPagination() {
  const url = "https://datasets-server.huggingface.co/rows?dataset=bettergovph%2Fdpwh-transparency-data&config=default&split=train&offset=100&length=100";
  console.log("Testing offset pagination on HF rows endpoint...");
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`Received ${data.rows?.length} rows (num_rows_total: ${data.num_rows_total?.toLocaleString()})`);
      console.log(`Sample contractId from offset 100: ${data.rows?.[0]?.row?.contractId}`);
    } else {
      console.log(`Status not ok: ${res.statusText}`);
      const text = await res.text();
      console.log(`Body preview: ${text.slice(0, 200)}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

testPagination();
