import { z } from "zod";
import { pola } from "./tanggal.js";

export const id = z.coerce.number().int().positive();
export const tanggal = z.string().regex(pola.tanggal, "Format tanggal harus YYYY-MM-DD");
export const bulan = z.string().regex(pola.bulan, "Format bulan harus YYYY-MM");
export const rupiah = z.number().int().positive().max(1_000_000_000_000);
export const rupiahNol = z.number().int().min(0).max(1_000_000_000_000);
export const teks = (maks = 300) => z.string().trim().min(1).max(maks);
export const teksOpsional = (maks = 300) =>
  z
    .string()
    .trim()
    .max(maks)
    .optional()
    .transform((v) => v || null);

export const queryBulan = z.object({ bulan: bulan.optional() });