async function testHF() {
  console.log("Testing Hugging Face first-rows endpoint...");
  try {
    const res = await fetch("https://datasets-server.huggingface.co/first-rows?dataset=bettergovph%2Fdpwh-transparency-data&config=default&split=train");
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log(`Received ${data.rows?.length} rows.`);
    if (data.rows && data.rows.length > 0) {
      console.log("Sample Project:", data.rows[0].row.contractId, "-", data.rows[0].row.description.slice(0, 60));
    }
  } catch (err) {
    console.log("Error:", err.message);
  }

  console.log("\nTesting Hugging Face Parquet Files API...");
  try {
    const res = await fetch("https://datasets-server.huggingface.co/parquet?dataset=bettergovph%2Fdpwh-transparency-data");
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log("Parquet files list:", data.parquet_files?.map(f => ({ filename: f.filename, size: f.size, num_rows: f.num_rows })));
  } catch (err) {
    console.log("Error:", err.message);
  }
}

testHF();
