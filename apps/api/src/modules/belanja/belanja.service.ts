import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";

export type BelanjaRow = {
  id: number;
  tanggal: string;
  supplierId: number;
  supplierNama: string;
  keterangan: string;
  total: number;
  status: "lunas" | "utang";
  dibayar: number;
  jatuhTempo: string | null;
  dompetNama: string | null;
};

/** Belanja beserta total yang sudah dibayar (uang muka/lunas + semua cicilan). */
export async function daftarBelanja(filter: { bulan?: string; hanyaUtang?: boolean }) {
  const { rows } = await db.execute<BelanjaRow>(sql`
    SELECT b.id, b.tanggal::text AS tanggal, b.supplier_id AS "supplierId", s.nama AS "supplierNama", b.keterangan, b.total, b.status,
           (b.dibayar_awal + COALESCE((SELECT SUM(p.jumlah) FROM pembayaran_utang p WHERE p.belanja_id = b.id), 0))::bigint AS dibayar,
           b.jatuh_tempo::text AS "jatuhTempo", d.nama AS "dompetNama"
    FROM belanja b
    JOIN supplier s ON s.id = b.supplier_id
    LEFT JOIN dompet d ON d.id = b.dompet_id
    WHERE (${filter.bulan ?? null}::text IS NULL OR to_char(b.tanggal, 'YYYY-MM') = ${filter.bulan ?? null})
      AND (${filter.hanyaUtang ?? false} = false OR b.status = 'utang')
    ORDER BY ${filter.hanyaUtang ? sql`b.jatuh_tempo ASC NULLS LAST,` : sql``} b.tanggal DESC, b.id DESC`);
  return rows;
}

export type PembayaranRow = {
  id: number;
  belanjaId: number;
  tanggal: string;
  jumlah: number;
  dompetNama: string;
};

export async function daftarPembayaran(belanjaIds: number[]) {
  if (belanjaIds.length === 0) return [];
  const { rows } = await db.execute<PembayaranRow>(sql`
    SELECT p.id, p.belanja_id AS "belanjaId", p.tanggal::text AS tanggal, p.jumlah, d.nama AS "dompetNama"
    FROM pembayaran_utang p JOIN dompet d ON d.id = p.dompet_id
    WHERE p.belanja_id IN (${sql.join(belanjaIds.map((i) => sql`${i}`), sql`, `)})
    ORDER BY p.tanggal DESC, p.id DESC`);
  return rows;
}