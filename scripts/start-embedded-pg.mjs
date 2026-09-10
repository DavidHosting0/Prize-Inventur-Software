/**
 * Dev helper: starts an embedded PostgreSQL on port 54329
 * when Docker / system Postgres is unavailable.
 */
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.join(process.cwd(), ".data", "pg");
fs.mkdirSync(dataDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "prize",
  password: "prize",
  port: 54329,
  persistent: true,
});

async function main() {
  const initialized = fs.existsSync(path.join(dataDir, "PG_VERSION"));
  if (!initialized) {
    console.log("Initializing embedded PostgreSQL cluster...");
    await pg.initialise();
  }
  console.log("Starting embedded PostgreSQL on port 54329...");
  await pg.start();
  try {
    await pg.createDatabase("prize_hotel");
    console.log("Database prize_hotel ready.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/already exists/i.test(msg)) {
      console.log("createDatabase note:", msg);
    } else {
      console.log("Database prize_hotel already exists.");
    }
  }
  console.log("Embedded Postgres is running. Keep this process alive.");
  console.log("DATABASE_URL=postgresql://prize:prize@127.0.0.1:54329/prize_hotel?schema=public");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
