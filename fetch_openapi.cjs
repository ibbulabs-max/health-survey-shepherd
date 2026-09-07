const https = require("https");
const fs = require("fs");

const env = fs.readFileSync(".env", "utf8");
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const url = urlMatch[1].trim() + "/rest/v1/?apikey=" + keyMatch[1].trim();
const key = keyMatch[1].trim();

https
  .get(
    url,
    {
      headers: {
        Authorization: "Bearer " + key,
      },
    },
    (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        fs.writeFileSync("openapi.json", data);
        console.log("OpenAPI schema saved to openapi.json");
      });
    },
  )
  .on("error", (err) => {
    console.error(err);
  });
