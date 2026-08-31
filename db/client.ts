import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
};

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error(
    "POSTGRES_URL não configurado. Copie .env.example para .env.local e preencha."
  );
}

const client =
  globalForDb.pgClient ??
  postgres(connectionString, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
