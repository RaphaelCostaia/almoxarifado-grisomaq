// Cliente Postgres para scripts de manutenção (migrations, seeds, cleanup).
// Usa POSTGRES_URL_ADMIN se definida (role owner com DDL/DELETE); cai pra
// POSTGRES_URL se não definida — mantém o setup single-role atual funcionando.
//
// Regra prática pra produção:
//   POSTGRES_URL       → role limitada (app runtime, sem DELETE/UPDATE em audit_log)
//   POSTGRES_URL_ADMIN → role owner (só usada por db/*.ts no entrypoint)
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.POSTGRES_URL_ADMIN ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error(
    "POSTGRES_URL_ADMIN ou POSTGRES_URL não configurada."
  );
}

const client = postgres(connectionString, {
  prepare: false,
  max: 3,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema });
export { schema };
