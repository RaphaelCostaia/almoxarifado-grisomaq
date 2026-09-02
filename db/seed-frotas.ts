// Le db/seed-frotas.json e faz INSERT ... ON CONFLICT DO NOTHING na tabela frotas.
// Idempotente: pode rodar N vezes.
// Rodar: `npm run db:seed-frotas`
// Ou automatico no docker-entrypoint.sh quando a tabela esta vazia.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "./client";
import { frotas } from "./schema";

type FrotaJson = {
  numero: string;
  categoria: "equipamento" | "implemento";
  modelo: string | null;
  marca: string | null;
  descricao: string | null;
  ano: string | null;
  placa: string | null;
  chassi: string | null;
  localizacao: string | null;
  proprietario: string | null;
  ativo: number;
  observacoes: string | null;
};

async function main() {
  const jsonPath = join(process.cwd(), "db", "seed-frotas.json");
  const raw = readFileSync(jsonPath, "utf-8");
  const registros: FrotaJson[] = JSON.parse(raw);

  const [antes] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(frotas);

  console.log(`[seed-frotas] ${registros.length} registros no JSON.`);
  console.log(`[seed-frotas] Tabela atualmente tem ${antes.c} registros.`);

  // Insere em batches de 50 pra caber no protocolo
  let inseridos = 0;
  const batchSize = 50;
  for (let i = 0; i < registros.length; i += batchSize) {
    const batch = registros.slice(i, i + batchSize);
    const inserted = await db
      .insert(frotas)
      .values(batch as any)
      .onConflictDoNothing({ target: frotas.numero })
      .returning({ id: frotas.id });
    inseridos += inserted.length;
  }

  const [depois] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(frotas);

  console.log(`[seed-frotas] ✓ ${inseridos} novos inseridos.`);
  console.log(`[seed-frotas] Tabela agora tem ${depois.c} registros.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("[seed-frotas] ERRO:", e);
  process.exit(1);
});
