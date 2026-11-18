import { and, eq, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../../db/client.js";
import { omzet } from "../../db/schema.js";
import { HttpError } from "../../lib/errors.js";
import { bulan, id, queryBulan, rupiah, rupiahNol, teksOpsional } from "../../lib/skema.js";
import { bulanSebelum, hariIni } from "../../lib/tanggal.js";

export type OmzetToko = {
  tokoId: number;
  tokoNama: string;
  platform: string;
  omzet: { id: number; omzetKotor: number; pph: number; potonganLain: number; omzetBersih: number; dompetNama: string } | null;
};

export const omzetRoutes: FastifyPluginAsyncZod = async (app) => {
  /** Semua toko aktif beserta omzetnya di bulan itu (null = belum diisi). Bawaan: bulan lalu. */
  app.get("/omzet", { schema: { querystring: queryBulan } }, async (req) => {
    const bl = req.query.bulan ?? bulanSebelum(hariIni().slice(0, 7));
    const { rows } = await db.execute<OmzetToko>(sql`
      SELECT t.id AS "tokoId", t.nama AS "tokoNama", t.platform,
        CASE WHEN o.id IS NULL THEN NULL ELSE json_build_object(
          'id', o.id, 'omzetKotor', o.omzet_kotor, 'pph', o.pph, 'potonganLain', o.potongan_lain,
          'omzetBersih', o.omzet_kotor - o.pph - o.potongan_lain, 'dompetNama', d.nama) END AS omzet
      FROM toko t
      LEFT JOIN omzet o ON o.toko_id = t.id AND o.bulan = ${bl}
      LEFT JOIN dompet d ON d.id = o.dompet_id
      WHERE t.aktif
      ORDER BY t.id`);
    return { bulan: bl, data: rows };
  });

  app.post(
    "/omzet",
    {
      schema: {
        body: z
          .object({ tokoId: id, bulan, omzetKotor: rupiah, pph: rupiahNol, potonganLain: rupiahNol, dompetId: id, catatan: teksOpsional() })
          .refine((b) => b.pph + b.potonganLain <= b.omzetKotor, { message: "PPh dan potongan tidak boleh lebih besar dari omzet kotor", path: ["potonganLain"] })
          .refine((b) => b.bulan <= hariIni().slice(0, 7), { message: "Bulan tidak boleh di masa depan", path: ["bulan"] }),
      },
    },
    async (req, reply) => {
      const b = req.body;
      // BR-07: satu data per toko per bulan (dijaga juga oleh constraint UNIQUE di database).
      const [ada] = await db.select({ id: omzet.id }).from(omzet).where(and(eq(omzet.tokoId, b.tokoId), eq(omzet.bulan, b.bulan)));
      if (ada) throw new HttpError(409, "Omzet toko ini untuk bulan tersebut sudah diisi. Silakan ubah data yang sudah ada.");
      const [baru] = await db.insert(omzet).values(b).returning();
      return reply.status(201).send({ ...baru, omzetBersih: baru.omzetKotor - baru.pph - baru.potonganLain });
    },
  );
};