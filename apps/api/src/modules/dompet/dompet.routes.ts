import { eq, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../../db/client.js";
import { danaMasuk, dompet, pindahDana } from "../../db/schema.js";
import { HttpError, tidakDitemukan } from "../../lib/errors.js";
import { id, rupiah, rupiahNol, tanggal, teks, teksOpsional } from "../../lib/skema.js";
import { hariIni } from "../../lib/tanggal.js";
import { daftarSaldo, riwayat } from "./dompet.service.js";

export const dompetRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/dompet", async () => daftarSaldo());

  app.post(
    "/dompet",
    {
      schema: {
        body: z.object({ nama: teks(60), jenis: z.enum(["tunai", "bank"]), noRekening: teksOpsional(40), saldoAwal: rupiahNol.default(0) }),
      },
    },
    async (req, reply) => {
      const [ada] = await db.select({ id: dompet.id }).from(dompet).where(eq(dompet.nama, req.body.nama));
      if (ada) throw new HttpError(409, "Dompet dengan nama ini sudah ada.");
      const [baru] = await db.insert(dompet).values(req.body).returning();
      return reply.status(201).send(baru);
    },
  );

  app.get(
    "/dompet/riwayat",
    { schema: { querystring: z.object({ dompetId: id.optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }) } },
    async (req) => riwayat(req.query.limit, req.query.dompetId),
  );

  /** BR-10: pindah dana tidak dihitung sebagai pemasukan maupun pengeluaran. */
  app.post(
    "/dompet/pindah",
    {
      schema: {
        body: z
          .object({ tanggal: tanggal.optional(), dariDompetId: id, keDompetId: id, jumlah: rupiah, keterangan: teksOpsional() })
          .refine((b) => b.dariDompetId !== b.keDompetId, { message: "Dompet asal dan tujuan tidak boleh sama", path: ["keDompetId"] }),
      },
    },
    async (req, reply) => {
      const b = req.body;
      const hasil = await db.transaction(async (tx) => {
        // Kunci baris dompet asal agar dua pemindahan bersamaan tidak membuat saldo minus.
        await tx.execute(sql`SELECT id FROM dompet WHERE id = ${b.dariDompetId} FOR UPDATE`);
        const [asal] = await daftarSaldo(tx, b.dariDompetId);
        if (!asal) throw tidakDitemukan("Dompet asal");
        if (b.jumlah > asal.saldo) throw new HttpError(400, `Saldo ${asal.nama} tidak cukup (sisa Rp${asal.saldo.toLocaleString("id-ID")}).`);
        const [baru] = await tx
          .insert(pindahDana)
          .values({ tanggal: b.tanggal ?? hariIni(), dariDompetId: b.dariDompetId, keDompetId: b.keDompetId, jumlah: b.jumlah, keterangan: b.keterangan })
          .returning();
        return baru;
      });
      return reply.status(201).send(hasil);
    },
  );

  /** BR-09: tambah modal menambah saldo, tetapi bukan keuntungan. */
  app.post(
    "/dompet/modal",
    { schema: { body: z.object({ tanggal: tanggal.optional(), dompetId: id, jumlah: rupiah, keterangan: teksOpsional() }) } },
    async (req, reply) => {
      const [baru] = await db
        .insert(danaMasuk)
        .values({ ...req.body, tanggal: req.body.tanggal ?? hariIni() })
        .returning();
      return reply.status(201).send(baru);
    },
  );
};