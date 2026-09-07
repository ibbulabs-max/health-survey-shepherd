const fs = require("fs");
const openapi = JSON.parse(fs.readFileSync("openapi.json", "utf8"));

let out = "# Supabase Live Schema\n\n";

out += "## Tables/Views\n";
if (openapi.paths) {
  for (const [path, methods] of Object.entries(openapi.paths)) {
    if (path.startsWith("/rpc/")) continue;
    if (path === "/") continue;

    const tableName = path.substring(1);
    out += `\n### ${tableName}\n`;
    const definition = openapi.definitions && openapi.definitions[tableName];
    if (definition && definition.properties) {
      for (const [propName, propDetails] of Object.entries(definition.properties)) {
        out += `- ${propName}: ${propDetails.type} (${propDetails.format || ""})\n`;
      }
    }
  }
}

out += "\n## RPC Functions\n";
if (openapi.paths) {
  for (const [path, methods] of Object.entries(openapi.paths)) {
    if (!path.startsWith("/rpc/")) continue;
    out += `- ${path.substring(5)}\n`;
  }
}

fs.writeFileSync("schema_live.md", out);
console.log("schema_live.md written");
