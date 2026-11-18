import { asc, eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../../db/client.js";
import { kategoriBiaya, supplier, toko } from "../../db/schema.js";
import { HttpError } from "../../lib/errors.js";
import { teks, teksOpsional } from "../../lib/skema.js";

/** Data dasar: toko, supplier, kategori biaya. */
export const masterRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/toko", async () => db.select().from(toko).where(eq(toko.aktif, true)).orderBy(asc(toko.id)));

  app.get("/supplier", async () => db.select().from(supplier).orderBy(asc(supplier.nama)));

  app.post(
    "/supplier",
    { schema: { body: z.object({ nama: teks(100), noHp: teksOpsional(30), alamat: teksOpsional(), catatan: teksOpsional() }) } },
    async (req, reply) => {
      const [ada] = await db.select({ id: supplier.id }).from(supplier).where(eq(supplier.nama, req.body.nama));
      if (ada) throw new HttpError(409, "Supplier dengan nama ini sudah ada.");
      const [baru] = await db.insert(supplier).values(req.body).returning();
      return reply.status(201).send(baru);
    },
  );

  app.get("/kategori-biaya", async () => db.select().from(kategoriBiaya).orderBy(asc(kategoriBiaya.id)));

  app.post(
    "/kategori-biaya",
    { schema: { body: z.object({ nama: teks(50), jenis: z.enum(["harian", "bulanan", "tidak-tentu"]).default("bulanan") }) } },
    async (req, reply) => {
      const [ada] = await db.select({ id: kategoriBiaya.id }).from(kategoriBiaya).where(eq(kategoriBiaya.nama, req.body.nama));
      if (ada) throw new HttpError(409, "Kategori ini sudah ada.");
      const [baru] = await db.insert(kategoriBiaya).values(req.body).returning();
      return reply.status(201).send(baru);
    },
  );
};