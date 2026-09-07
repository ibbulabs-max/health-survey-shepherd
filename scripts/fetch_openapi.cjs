require('dotenv').config();

async function run() {
  const url = process.env.VITE_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(url);
  const data = await response.json();
  const fs = require('fs');
  fs.writeFileSync('openapi.json', JSON.stringify(data, null, 2));
  console.log("Wrote openapi.json");
}
run();
