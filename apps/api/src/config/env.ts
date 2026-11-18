import { z } from "zod";

const schema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib diisi.'),
    COOKIE_DOMAIN: z.string().optional().transform((v) => v || undefined),
});

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === "production";