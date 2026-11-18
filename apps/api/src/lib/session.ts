import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";

const JAM = 60 * 60 * 1000;
const HARI = 24 * JAM;

/** Remember me: 30 hari. Tanpa remember me: 12 jam sejak terakhir dipakai. */
export const DURASI = { remember: 30 * HARI, biasa: 12 * JAM };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface SesiUser {
  id: number;
  username: string;
  nama: string;
}

export async function buatSesi(userId: number, remember: boolean, userAgent?: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (remember ? DURASI.remember : DURASI.biasa));
  await db.insert(sessions).values({ id: hashToken(token), userId, remember, expiresAt, userAgent: userAgent?.slice(0, 300) });
  return { token, expiresAt, remember };
}

/**
 * Memeriksa token. Sesi yang masih aktif diperpanjang otomatis (sliding):
 * remember me diperpanjang bila sisa < 15 hari, sesi biasa bila sisa < 11 jam.
 */
export async function periksaSesi(token: string) {
  const id = hashToken(token);
  const [baris] = await db
    .select({ expiresAt: sessions.expiresAt, remember: sessions.remember, user: { id: users.id, username: users.username, nama: users.nama } })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id));

  if (!baris) return null;
  const sisa = baris.expiresAt.getTime() - Date.now();
  if (sisa <= 0) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }

  const durasi = baris.remember ? DURASI.remember : DURASI.biasa;
  const batasPerpanjang = baris.remember ? 15 * HARI : 11 * JAM;
  let expiresAt = baris.expiresAt;
  let diperpanjang = false;
  if (sisa < batasPerpanjang) {
    expiresAt = new Date(Date.now() + durasi);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
    diperpanjang = true;
  }
  return { user: baris.user as SesiUser, remember: baris.remember, expiresAt, diperpanjang };
}

export async function hapusSesi(token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}