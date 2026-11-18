import { eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { HttpError } from "../../lib/errors.js";
import { HASH_PALSU, verifyPassword } from "../../lib/password.js";
import { buatSesi, hapusSesi } from "../../lib/session.js";
import { ambilToken, hapusCookie, pasangCookie, wajibLogin } from "../../plugins/auth.js";

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/login",
    {
      // Maksimal 5 percobaan per menit per alamat IP.
      config: { rateLimit: { max: 5, timeWindow: "1 minute", errorResponseBuilder: () => ({ statusCode: 429, message: "Terlalu banyak percobaan. Tunggu 1 menit lalu coba lagi." }) } },
      schema: {
        body: z.object({
          username: z.string().trim().min(1).max(100),
          password: z.string().min(1).max(200),
          remember: z.boolean().default(false),
          client: z.enum(["web", "mobile"]).default("web"),
        }),
      },
    },
    async (req, reply) => {
      const { username, password, remember, client } = req.body;
      const [user] = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
      const cocok = await verifyPassword(password, user?.passwordHash ?? HASH_PALSU);
      if (!user || !cocok) throw new HttpError(401, "Nama pengguna atau kata sandi salah.");

      const sesi = await buatSesi(user.id, remember, req.headers["user-agent"]);
      const profil = { id: user.id, username: user.username, nama: user.nama };

      if (client === "mobile") {
        // Expo menyimpan token ini di expo-secure-store, lalu mengirimnya sebagai Bearer.
        return { user: profil, token: sesi.token, expiresAt: sesi.expiresAt.toISOString() };
      }
      pasangCookie(reply, sesi.token, remember, sesi.expiresAt);
      return { user: profil };
    },
  );

  app.post("/logout", async (req, reply) => {
    const t = ambilToken(req);
    if (t) await hapusSesi(t.token);
    hapusCookie(reply);
    return { ok: true };
  });

  app.get("/me", { preHandler: wajibLogin }, async (req) => ({ user: req.user }));
};