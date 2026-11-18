import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyError } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { isProd } from "./config/env.js";
import { HttpError } from "./lib/errors.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { belanjaRoutes } from "./modules/belanja/belanja.routes.js";
import { biayaRoutes } from "./modules/biaya/biaya.routes.js";
import { dompetRoutes } from "./modules/dompet/dompet.routes.js";
import { laporanRoutes } from "./modules/laporan/laporan.routes.js";
import { masterRoutes } from "./modules/master/master.routes.js";
import { omzetRoutes } from "./modules/omzet/omzet.routes.js";
import { wajibLogin } from "./plugins/auth.js";

// Pesan validasi Zod dalam Bahasa Indonesia.
z.config(z.locales.id());

export async function buildApp() {
  const app = Fastify({
    logger: isProd ? { level: "info" } : { level: "info", transport: undefined },
    trustProxy: true, // di belakang Next.js rewrites / Caddy
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet);
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  app.decorateRequest("user", null);

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send({ message: err.message });
    }
    if (err.validation) {
      const pertama = err.validation[0];
      const kolom = pertama?.instancePath?.replace(/^\//, "") || "";
      return reply.status(400).send({ message: `Data tidak valid${kolom ? ` (${kolom})` : ""}: ${pertama?.message ?? err.message}` });
    }
    // Galat PostgreSQL (Drizzle membungkusnya di `cause`).
    const kodePg = ((err as { cause?: { code?: string } }).cause ?? (err as { code?: string })).code;
    if (kodePg === "23503") return reply.status(400).send({ message: "Data terkait (dompet, supplier, toko, atau kategori) tidak ditemukan." });
    if (kodePg === "23505") return reply.status(409).send({ message: "Data ini sudah ada." });
    if (kodePg === "23514") return reply.status(400).send({ message: "Data tidak memenuhi aturan pencatatan." });

    if (err.statusCode && err.statusCode < 500) {
      return reply.status(err.statusCode).send({ message: err.message });
    }
    req.log.error(err);
    return reply.status(500).send({ message: "Terjadi kesalahan di server. Silakan coba lagi." });
  });

  app.get("/health", async () => ({ ok: true }));

  await app.register(authRoutes, { prefix: "/auth" });

  // Semua rute di dalam blok ini wajib login.
  await app.register(async (aman) => {
    aman.addHook("preHandler", wajibLogin);
    await aman.register(masterRoutes);
    await aman.register(dompetRoutes);
    await aman.register(belanjaRoutes);
    await aman.register(omzetRoutes);
    await aman.register(biayaRoutes);
    await aman.register(laporanRoutes);
  });

  return app;
}