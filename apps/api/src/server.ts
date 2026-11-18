import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/client.js";

const app = await buildApp();

const tutup = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on("SIGINT", tutup);
process.on("SIGTERM", tutup);

await app.listen({ host: env.HOST, port: env.PORT });