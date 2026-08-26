async function test() {
  console.log("1. Testing DPWH Transparency API directly...");
  try {
    const res = await fetch("https://api.transparency.dpwh.gov.ph/projects?page=1&limit=2", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*"
      },
      signal: AbortSignal.timeout(10000)
    });
    console.log(`DPWH Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log("DPWH Sample Response (first 200 chars):", text.slice(0, 200));
  } catch (err) {
    console.log("DPWH Direct Error:", err.message);
  }

  console.log("\n2. Testing Hugging Face DPWH Dataset Mirror (bettergovph/dpwh-transparency-data)...");
  try {
    const res = await fetch("https://datasets-server.huggingface.co/rows?dataset=bettergovph%2Fdpwh-transparency-data&config=default&split=train&offset=0&length=2", {
      signal: AbortSignal.timeout(10000)
    });
    console.log(`HuggingFace Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log(`HuggingFace Total Rows Available: ${data.num_rows_total?.toLocaleString()}`);
    if (data.rows && data.rows.length > 0) {
      console.log("First Contract ID:", data.rows[0].row.contractId);
      console.log("First Project Name:", data.rows[0].row.description);
      console.log("First Project Budget: ₱", data.rows[0].row.budget);
      console.log("First Project Location:", JSON.stringify(data.rows[0].row.location));
      console.log("First Project Progress:", data.rows[0].row.progress, "%");
    }
  } catch (err) {
    console.log("HuggingFace Error:", err.message);
  }
}

test();
