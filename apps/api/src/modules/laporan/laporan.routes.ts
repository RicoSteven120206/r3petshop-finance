import { sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { db } from "../../db/client.js";
import { queryBulan } from "../../lib/skema.js";
import { bulanSebelum, hariIni } from "../../lib/tanggal.js";
import { daftarBelanja } from "../belanja/belanja.service.js";
import { daftarSaldo, riwayat } from "../dompet/dompet.service.js";
import { bulanLengkapTerakhir, laporanBulan } from "./laporan.service.js";

export const laporanRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/laporan", { schema: { querystring: queryBulan } }, async (req) => {
    return laporanBulan(req.query.bulan ?? bulanSebelum(hariIni().slice(0, 7)));
  });

  /** Semua data untuk halaman Beranda dalam satu permintaan. */
  app.get("/ringkasan", async () => {
    const today = hariIni();
    const bulanIni = today.slice(0, 7);
    const bulanLalu = bulanSebelum(bulanIni);

    const [dompet, utang, bulanTerakhir, transaksi, totalBulanIni, tokoBelum] = await Promise.all([
      daftarSaldo(),
      daftarBelanja({ hanyaUtang: true }),
      bulanLengkapTerakhir(bulanIni),
      riwayat(5),
      db.execute<{ belanja: number; biaya: number }>(sql`
        SELECT (SELECT COALESCE(SUM(total), 0) FROM belanja WHERE to_char(tanggal, 'YYYY-MM') = ${bulanIni})::bigint AS belanja,
               (SELECT COALESCE(SUM(jumlah), 0) FROM biaya WHERE to_char(tanggal, 'YYYY-MM') = ${bulanIni})::bigint AS biaya`),
      db.execute<{ id: number; nama: string }>(sql`
        SELECT t.id, t.nama FROM toko t
        WHERE t.aktif AND NOT EXISTS (SELECT 1 FROM omzet o WHERE o.toko_id = t.id AND o.bulan = ${bulanLalu})
        ORDER BY t.id`),
    ]);

    return {
      hariIni: today,
      bulanIni,
      bulanLalu,
      dompet,
      utangAktif: utang.filter((u) => u.total > u.dibayar).map((u) => ({ ...u, sisa: u.total - u.dibayar })),
      laporanTerakhir: bulanTerakhir ? await laporanBulan(bulanTerakhir) : null,
      bulanIniTotal: totalBulanIni.rows[0],
      tokoBelumIsiOmzet: tokoBelum.rows,
      transaksiTerakhir: transaksi,
    };
  });
};