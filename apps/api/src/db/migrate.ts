import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

const folder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");

await migrate(db, { migrationsFolder: folder });
console.log("Migrasi database selesai.");
await pool.end();