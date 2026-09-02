// Le db/seed-pecas.json e faz INSERT ... ON CONFLICT DO NOTHING na tabela pecas.
// Idempotente: pode rodar N vezes.
// Rodar: `npm run db:seed-pecas`
// Ou automatico no docker-entrypoint.sh.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "./client";
import { pecas } from "./schema";

type PecaJson = {
  codigo: string;
  nome: string;
  unidade: string;
  saldo: string; // numeric — enviamos como string pra drizzle
  familia: string | null;
  codigoFabricante: string | null;
  codigoParalelo: string | null;
};

async function main() {
  const jsonPath = join(process.cwd(), "db", "seed-pecas.json");
  const raw = readFileSync(jsonPath, "utf-8");
  const registros: PecaJson[] = JSON.parse(raw);

  const [antes] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(pecas);

  console.log(`[seed-pecas] ${registros.length} registros no JSON.`);
  console.log(`[seed-pecas] Tabela atualmente tem ${antes.c} peças.`);

  // Insere em batches de 200 (14k linhas × 7 colunas curtas cabe folgado)
  let inseridos = 0;
  const batchSize = 200;
  for (let i = 0; i < registros.length; i += batchSize) {
    const batch = registros.slice(i, i + batchSize);
    const inserted = await db
      .insert(pecas)
      .values(batch as any)
      .onConflictDoNothing({ target: pecas.codigo })
      .returning({ id: pecas.id });
    inseridos += inserted.length;
    if (i % 2000 === 0 && i > 0) {
      console.log(`[seed-pecas]   ${i}/${registros.length} processados…`);
    }
  }

  const [depois] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(pecas);

  console.log(`[seed-pecas] ✓ ${inseridos} novos inseridos.`);
  console.log(`[seed-pecas] Tabela agora tem ${depois.c} peças.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("[seed-pecas] ERRO:", e);
  process.exit(1);
});
