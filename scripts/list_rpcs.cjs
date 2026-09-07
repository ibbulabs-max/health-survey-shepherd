require('dotenv').config();

async function run() {
  const url = process.env.VITE_SUPABASE_URL + '/rest/v1/';
  const response = await fetch(url, {
    headers: {
      'apikey': process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  });
  const data = await response.json();
  console.log("Endpoints:");
  Object.keys(data.paths || {}).forEach(k => {
    if (k.startsWith('/rpc/')) console.log(k);
  });
}
run();
