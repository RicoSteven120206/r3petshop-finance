import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";

/** BR-11: hasil = omzet bersih − belanja (lunas + utang) − biaya rutin. Dihitung di server sebagai sumber kebenaran. */
export async function laporanBulan(bulan: string) {
  const [o, b, c] = await Promise.all([
    db.execute<{ kotor: number; pph: number; potongan: number; terisi: number; jumlahToko: number }>(sql`
      SELECT COALESCE(SUM(omzet_kotor), 0)::bigint AS kotor, COALESCE(SUM(pph), 0)::bigint AS pph,
             COALESCE(SUM(potongan_lain), 0)::bigint AS potongan, COUNT(*)::int AS terisi,
             (SELECT COUNT(*) FROM toko WHERE aktif)::int AS "jumlahToko"
      FROM omzet WHERE bulan = ${bulan}`),
    db.execute<{ status: "lunas" | "utang"; total: number }>(sql`
      SELECT status, SUM(total)::bigint AS total FROM belanja WHERE to_char(tanggal, 'YYYY-MM') = ${bulan} GROUP BY status`),
    db.execute<{ kategori: string; jumlah: number }>(sql`
      SELECT k.nama AS kategori, SUM(c.jumlah)::bigint AS jumlah
      FROM biaya c JOIN kategori_biaya k ON k.id = c.kategori_id
      WHERE to_char(c.tanggal, 'YYYY-MM') = ${bulan}
      GROUP BY k.nama ORDER BY jumlah DESC`),
  ]);

  const om = o.rows[0];
  const belanjaLunas = b.rows.find((r) => r.status === "lunas")?.total ?? 0;
  const belanjaUtang = b.rows.find((r) => r.status === "utang")?.total ?? 0;
  const biayaPerKategori = c.rows;
  const omzetBersih = om.kotor - om.pph - om.potongan;
  const totalBelanja = belanjaLunas + belanjaUtang;
  const totalBiaya = biayaPerKategori.reduce((t, r) => t + r.jumlah, 0);

  return {
    bulan,
    lengkap: om.terisi >= om.jumlahToko && om.jumlahToko > 0,
    tokoTerisi: om.terisi,
    jumlahToko: om.jumlahToko,
    omzetKotor: om.kotor,
    pph: om.pph,
    potonganLain: om.potongan,
    omzetBersih,
    belanjaLunas,
    belanjaUtang,
    belanja: totalBelanja,
    biayaPerKategori,
    biaya: totalBiaya,
    hasil: omzetBersih - totalBelanja - totalBiaya,
  };
}

/** Bulan terakhir (sebelum bulan ini) yang omzet semua tokonya sudah lengkap. */
export async function bulanLengkapTerakhir(sebelumBulan: string) {
  const { rows } = await db.execute<{ bulan: string }>(sql`
    SELECT bulan FROM omzet
    WHERE bulan < ${sebelumBulan}
    GROUP BY bulan
    HAVING COUNT(DISTINCT toko_id) >= (SELECT COUNT(*) FROM toko WHERE aktif)
    ORDER BY bulan DESC LIMIT 1`);
  return rows[0]?.bulan ?? null;
}