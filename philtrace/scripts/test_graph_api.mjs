async function testGraphRoute() {
  try {
    const res = await fetch("http://localhost:3000/api/contractors/graph");
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`Nodes count: ${data.nodes?.length}`);
      console.log(`Edges count: ${data.edges?.length}`);
      if (data.nodes?.length > 0) {
        console.log("Sample Node 0:", JSON.stringify(data.nodes[0]));
      }
      if (data.edges?.length > 0) {
        console.log("Sample Edge 0:", JSON.stringify(data.edges[0]));
      }
    } else {
      console.log("API not responding with 200:", await res.text());
    }
  } catch (err) {
    console.log("Fetch failed (is dev server running?):", err.message);
  }
}
testGraphRoute();
