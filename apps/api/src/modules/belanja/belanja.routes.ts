import { sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../../db/client.js";
import { belanja, pembayaranUtang } from "../../db/schema.js";
import { HttpError, tidakDitemukan } from "../../lib/errors.js";
import { id, queryBulan, rupiah, rupiahNol, tanggal, teks, teksOpsional } from "../../lib/skema.js";
import { hariIni } from "../../lib/tanggal.js";
import { daftarBelanja, daftarPembayaran } from "./belanja.service.js";

const belanjaBaru = z
  .object({
    tanggal,
    supplierId: id,
    keterangan: teks(300),
    total: rupiah,
    status: z.enum(["lunas", "utang"]),
    dompetId: id.optional(),
    jatuhTempo: tanggal.optional(),
    uangMuka: rupiahNol.default(0),
    catatan: teksOpsional(),
  })
  .superRefine((b, ctx) => {
    if (b.status === "lunas" && !b.dompetId) ctx.addIssue({ code: "custom", path: ["dompetId"], message: "Pilih dompet untuk membayar" });
    if (b.status === "utang") {
      if (!b.jatuhTempo) ctx.addIssue({ code: "custom", path: ["jatuhTempo"], message: "Tanggal jatuh tempo wajib diisi" });
      else if (b.jatuhTempo < b.tanggal) ctx.addIssue({ code: "custom", path: ["jatuhTempo"], message: "Jatuh tempo tidak boleh sebelum tanggal belanja" });
      if (b.uangMuka >= b.total) ctx.addIssue({ code: "custom", path: ["uangMuka"], message: "Uang muka harus lebih kecil dari total" });
      if (b.uangMuka > 0 && !b.dompetId) ctx.addIssue({ code: "custom", path: ["dompetId"], message: "Pilih dompet untuk uang muka" });
    }
  });

export const belanjaRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/belanja", { schema: { querystring: queryBulan } }, async (req) => daftarBelanja({ bulan: req.query.bulan ?? hariIni().slice(0, 7) }));

  /** BR-01 dan BR-02: lunas langsung mengurangi saldo, utang hanya sebesar uang muka. */
  app.post("/belanja", { schema: { body: belanjaBaru } }, async (req, reply) => {
    const b = req.body;
    const lunas = b.status === "lunas";
    const [baru] = await db
      .insert(belanja)
      .values({
        tanggal: b.tanggal,
        supplierId: b.supplierId,
        keterangan: b.keterangan,
        total: b.total,
        status: b.status,
        dompetId: lunas || b.uangMuka > 0 ? b.dompetId : null,
        dibayarAwal: lunas ? b.total : b.uangMuka,
        jatuhTempo: lunas ? null : b.jatuhTempo,
        catatan: b.catatan,
      })
      .returning();
    return reply.status(201).send(baru);
  });

  app.get("/utang", async () => {
    const daftar = await daftarBelanja({ hanyaUtang: true });
    const pembayaran = await daftarPembayaran(daftar.map((d) => d.id));
    return daftar.map((d) => ({ ...d, sisa: d.total - d.dibayar, pembayaran: pembayaran.filter((p) => p.belanjaId === d.id) }));
  });

  /** BR-03 dan BR-04: bayar tidak boleh melebihi sisa; sisa 0 berarti lunas. */
  app.post(
    "/utang/bayar",
    { schema: { body: z.object({ belanjaId: id, tanggal: tanggal.optional(), jumlah: rupiah, dompetId: id, keterangan: teksOpsional() }) } },
    async (req, reply) => {
      const b = req.body;
      const hasil = await db.transaction(async (tx) => {
        const { rows } = await tx.execute<{ status: string; sisa: number }>(sql`
          SELECT b.status, (b.total - b.dibayar_awal - COALESCE((SELECT SUM(jumlah) FROM pembayaran_utang WHERE belanja_id = b.id), 0))::bigint AS sisa
          FROM belanja b WHERE b.id = ${b.belanjaId} FOR UPDATE`);
        const utang = rows[0];
        if (!utang) throw tidakDitemukan("Data utang");
        if (utang.status !== "utang") throw new HttpError(400, "Belanja ini bukan utang.");
        if (utang.sisa <= 0) throw new HttpError(400, "Utang ini sudah lunas.");
        if (b.jumlah > utang.sisa) throw new HttpError(400, `Jumlah bayar melebihi sisa utang (Rp${utang.sisa.toLocaleString("id-ID")}).`);

        await tx.insert(pembayaranUtang).values({ belanjaId: b.belanjaId, tanggal: b.tanggal ?? hariIni(), jumlah: b.jumlah, dompetId: b.dompetId, keterangan: b.keterangan });
        const sisa = utang.sisa - b.jumlah;
        return { sisa, lunas: sisa === 0 };
      });
      return reply.status(201).send(hasil);
    },
  );
};