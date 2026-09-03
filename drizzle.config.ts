import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Prefere URL admin (owner) se definida; scripts de DDL precisam dela.
    url: (process.env.POSTGRES_URL_ADMIN ?? process.env.POSTGRES_URL)!,
  },
} satisfies Config;
