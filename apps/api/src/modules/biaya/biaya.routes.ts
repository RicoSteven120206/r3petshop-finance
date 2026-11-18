import { sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../../db/client.js";
import { biaya } from "../../db/schema.js";
import { id, queryBulan, rupiah, tanggal, teksOpsional } from "../../lib/skema.js";
import { hariIni } from "../../lib/tanggal.js";

export const biayaRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/biaya", { schema: { querystring: queryBulan } }, async (req) => {
    const bl = req.query.bulan ?? hariIni().slice(0, 7);
    const { rows } = await db.execute(sql`
      SELECT c.id, c.tanggal::text AS tanggal, k.nama AS kategori, c.jumlah, d.nama AS "dompetNama", c.keterangan
      FROM biaya c JOIN kategori_biaya k ON k.id = c.kategori_id JOIN dompet d ON d.id = c.dompet_id
      WHERE to_char(c.tanggal, 'YYYY-MM') = ${bl}
      ORDER BY c.tanggal DESC, c.id DESC`);
    return rows;
  });

  app.post(
    "/biaya",
    { schema: { body: z.object({ tanggal, kategoriId: id, jumlah: rupiah, dompetId: id, keterangan: teksOpsional() }) } },
    async (req, reply) => {
      const [baru] = await db.insert(biaya).values(req.body).returning();
      return reply.status(201).send(baru);
    },
  );
};