import { db, pool } from "./client.js";
import { users } from "./schema.js";
import { hashPassword, verifyPassword } from "../lib/password.js";

const username = (process.env.OWNER_USERNAME ?? "").trim().toLowerCase();
const password = process.env.OWNER_PASSWORD ?? "";
console.log("1. Username di .env:", JSON.stringify(username), "| panjang sandi:", password.length);

const semua = await db.select({ username: users.username, hash: users.passwordHash }).from(users);
console.log("2. User di database:", semua.map((u) => `${u.username} -> ${u.hash.slice(0, 15)}...`));

const hashBaru = await hashPassword(password);
console.log("3. password.ts berfungsi:", await verifyPassword(password, hashBaru));

const user = semua.find((u) => u.username === username);
if (!user) console.log("4. GAGAL: user tidak ada di database. Jalankan npm run db:seed");
else console.log("4. Sandi .env cocok dengan database:", await verifyPassword(password, user.hash));

await pool.end();