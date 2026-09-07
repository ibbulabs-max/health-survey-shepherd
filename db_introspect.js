import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    await client.connect();

    // 1. Check for PostGIS
    const resPostGIS = await client.query(`
      SELECT installed_version 
      FROM pg_available_extensions 
      WHERE name = 'postgis';
    `);
    
    // 2. Check installed tables in public schema
    const resTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    // 3. Check for map_areas, global_settings, user_settings columns
    const resColumns = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name IN ('map_areas', 'global_settings', 'user_settings', 'profiles', 'health_threshold_settings', 'analytics_dashboards')
      ORDER BY table_name, ordinal_position;
    `);

    console.log("=== POSTGIS STATUS ===");
    console.log(resPostGIS.rows);

    console.log("\n=== PUBLIC TABLES ===");
    console.log(resTables.rows.map(r => r.table_name).join(", "));

    console.log("\n=== SELECTED COLUMNS ===");
    const colsByTable = resColumns.rows.reduce((acc, row) => {
      if (!acc[row.table_name]) acc[row.table_name] = [];
      acc[row.table_name].push(`${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
      return acc;
    }, {});
    console.log(JSON.stringify(colsByTable, null, 2));

  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    await client.end();
  }
}

run();
