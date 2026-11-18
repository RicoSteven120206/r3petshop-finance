import type { FastifyReply, FastifyRequest } from "fastify";
import { env, isProd } from "../config/env.js";
import { HttpError } from "../lib/errors.js";
import { periksaSesi, type SesiUser } from "../lib/session.js";

declare module "fastify" {
    interface FastifyRequest {
        user: SesiUser | null;
    }
}

export const COOKIE_SESI = "sid";

export function pasangCookie(reply: FastifyReply, token: string, remember: boolean, expiresAt: Date) {
    reply.setCookie(COOKIE_SESI, token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        domain: env.COOKIE_DOMAIN,
        ...(remember ? { expires: expiresAt } : {}),
    });
}

export function hapusCookie(reply: FastifyReply) {
  reply.clearCookie(COOKIE_SESI, { path: "/", domain: env.COOKIE_DOMAIN });
}

export function ambilToken(req: FastifyRequest): { token: string; dari: "cookie" | "bearer" } | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return { token: auth.slice(7), dari: "bearer" };
  const cookie = req.cookies[COOKIE_SESI];
  return cookie ? { token: cookie, dari: "cookie" } : null;
}

export async function wajibLogin(req: FastifyRequest, reply: FastifyReply) {
  const t = ambilToken(req);
  if (!t) throw new HttpError(401, "Silakan masuk terlebih dahulu.");

  const sesi = await periksaSesi(t.token);
  if (!sesi) {
    if (t.dari === "cookie") hapusCookie(reply);
    throw new HttpError(401, "Sesi sudah berakhir. Silakan masuk kembali.");
  }

  req.user = sesi.user;
  if (sesi.diperpanjang && t.dari === "cookie" && sesi.remember) {
    pasangCookie(reply, t.token, true, sesi.expiresAt);
  }
}