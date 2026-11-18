import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const PANJANG = 64;
const PEMISAH = "$";

/** Hash kata sandi dengan scrypt bawaan Node (tanpa dependensi native). Format: scrypt, salt, hash dipisah tanda dolar. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, PANJANG);
  return ["scrypt", salt.toString("base64"), hash.toString("base64")].join(PEMISAH);
}

export async function verifyPassword(password: string, tersimpan: string) {
  const [algo, saltB64, hashB64] = tersimpan.split(PEMISAH);
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const hash = await scrypt(password, Buffer.from(saltB64, "base64"), PANJANG);
  const target = Buffer.from(hashB64, "base64");
  return target.length === hash.length && timingSafeEqual(hash, target);
}

/** Hash palsu agar waktu respons sama walau username tidak ada (mencegah tebak username). */
export const HASH_PALSU = ["scrypt", Buffer.alloc(16).toString("base64"), Buffer.alloc(PANJANG).toString("base64")].join(PEMISAH);