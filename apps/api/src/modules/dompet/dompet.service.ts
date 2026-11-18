import { sql } from "drizzle-orm";
import { db, type Tx } from "../../db/client.js";

export type SaldoDompet = {
  id: number;
  nama: string;
  jenis: "tunai" | "bank";
  noRekening: string | null;
  saldoAwal: number;
  saldo: number;
};

/**
 * Saldo = saldo awal + modal masuk + omzet bersih + pindahan masuk
 *        − pindahan keluar − belanja dibayar − bayar utang − biaya rutin
 */
export async function daftarSaldo(exec: typeof db | Tx = db, dompetId?: number) {
  const { rows } = await exec.execute<SaldoDompet>(sql`
    SELECT d.id, d.nama, d.jenis, d.no_rekening AS "noRekening", d.saldo_awal AS "saldoAwal",
      (d.saldo_awal
        + COALESCE((SELECT SUM(jumlah) FROM dana_masuk WHERE dompet_id = d.id), 0)
        + COALESCE((SELECT SUM(omzet_kotor - pph - potongan_lain) FROM omzet WHERE dompet_id = d.id), 0)
        + COALESCE((SELECT SUM(jumlah) FROM pindah_dana WHERE ke_dompet_id = d.id), 0)
        - COALESCE((SELECT SUM(jumlah) FROM pindah_dana WHERE dari_dompet_id = d.id), 0)
        - COALESCE((SELECT SUM(dibayar_awal) FROM belanja WHERE dompet_id = d.id), 0)
        - COALESCE((SELECT SUM(jumlah) FROM pembayaran_utang WHERE dompet_id = d.id), 0)
        - COALESCE((SELECT SUM(jumlah) FROM biaya WHERE dompet_id = d.id), 0)
      )::bigint AS saldo
    FROM dompet d
    WHERE d.aktif AND (${dompetId ?? null}::int IS NULL OR d.id = ${dompetId ?? null})
    ORDER BY d.id`);
  return rows;
}

export type Transaksi = {
  id: string;
  tanggal: string;
  keterangan: string;
  jenis: string;
  dompet: string;
  arah: "masuk" | "keluar" | "netral";
  jumlah: number;
};

/** Riwayat uang masuk/keluar dari semua sumber. Bila `dompetId` diisi, pindah dana diberi arah masuk/keluar. */
export async function riwayat(limit: number, dompetId?: number) {
  const f = dompetId ?? null;
  const { rows } = await db.execute<Transaksi>(sql`
    SELECT r.id, r.tanggal, r.keterangan, r.jenis, r.dompet, r.jumlah,
      CASE WHEN ${f}::int IS NOT NULL AND r.arah = 'netral'
           THEN CASE WHEN r.d1 = ${f} THEN 'keluar' ELSE 'masuk' END
           ELSE r.arah END AS arah
    FROM (
      SELECT 'b' || b.id AS id, b.tanggal::text AS tanggal, b.keterangan,
             CASE WHEN b.status = 'lunas' THEN 'Belanja (lunas)' ELSE 'Uang muka belanja' END AS jenis,
             d.nama AS dompet, 'keluar' AS arah, b.dibayar_awal AS jumlah, b.created_at AS dibuat, b.dompet_id AS d1, NULL::int AS d2
        FROM belanja b JOIN dompet d ON d.id = b.dompet_id WHERE b.dibayar_awal > 0
      UNION ALL
      SELECT 'p' || p.id, p.tanggal::text, 'Bayar utang ' || s.nama, 'Bayar utang', d.nama, 'keluar', p.jumlah, p.created_at, p.dompet_id, NULL
        FROM pembayaran_utang p JOIN belanja b ON b.id = p.belanja_id JOIN supplier s ON s.id = b.supplier_id JOIN dompet d ON d.id = p.dompet_id
      UNION ALL
      SELECT 'c' || c.id, c.tanggal::text, COALESCE(c.keterangan, k.nama), 'Biaya rutin', d.nama, 'keluar', c.jumlah, c.created_at, c.dompet_id, NULL
        FROM biaya c JOIN kategori_biaya k ON k.id = c.kategori_id JOIN dompet d ON d.id = c.dompet_id
      UNION ALL
      SELECT 'o' || o.id, (o.created_at AT TIME ZONE 'Asia/Jakarta')::date::text, 'Omzet ' || o.bulan || ' ' || t.nama, 'Penjualan', d.nama, 'masuk',
             o.omzet_kotor - o.pph - o.potongan_lain, o.created_at, o.dompet_id, NULL
        FROM omzet o JOIN toko t ON t.id = o.toko_id JOIN dompet d ON d.id = o.dompet_id
      UNION ALL
      SELECT 'm' || m.id, m.tanggal::text, COALESCE(m.keterangan, 'Tambah modal'), 'Tambah modal', d.nama, 'masuk', m.jumlah, m.created_at, m.dompet_id, NULL
        FROM dana_masuk m JOIN dompet d ON d.id = m.dompet_id
      UNION ALL
      SELECT 'x' || x.id, x.tanggal::text, COALESCE(x.keterangan, 'Pindah dana'), 'Pindah dana', a.nama || ' → ' || k.nama, 'netral', x.jumlah, x.created_at,
             x.dari_dompet_id, x.ke_dompet_id
        FROM pindah_dana x JOIN dompet a ON a.id = x.dari_dompet_id JOIN dompet k ON k.id = x.ke_dompet_id
    ) r
    WHERE ${f}::int IS NULL OR r.d1 = ${f} OR r.d2 = ${f}
    ORDER BY r.tanggal DESC, r.dibuat DESC
    LIMIT ${limit}`);
  return rows;
}