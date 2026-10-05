// Verificação pós-atualização de frotas e peças.
// Lê o audit_log recente, imprime contagens, verifica cadeia de hash
// e checa integridade referencial.
//
// Uso: npx tsx --env-file=.env.local scripts/verificar-pos-atualizacao.ts

import { sql, isNull, desc } from "drizzle-orm";
import { db } from "../db/client-admin";
import { pecas, frotas, auditLog } from "../db/schema";
import { verificarCadeia } from "../lib/auditar";

async function main() {
  console.log("\n============================================================");
  console.log(" VERIFICAÇÃO PÓS-ATUALIZAÇÃO");
  console.log("============================================================");

  // Contagens atuais
  const [peTotal] = await db.select({ c: sql<number>`count(*)::int` }).from(pecas);
  const [peAtivas] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(pecas)
    .where(isNull(pecas.deletadoEm));
  const [frTotal] = await db.select({ c: sql<number>`count(*)::int` }).from(frotas);
  const [frAtivas] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(frotas)
    .where(isNull(frotas.deletadoEm));
  const [somaSaldos] = await db
    .select({ s: sql<string>`COALESCE(SUM(saldo), 0)::text` })
    .from(pecas)
    .where(isNull(pecas.deletadoEm));

  console.log(`  Peças total:        ${peTotal.c}  (ativas: ${peAtivas.c})`);
  console.log(`  Frotas total:       ${frTotal.c}  (ativas: ${frAtivas.c})`);
  console.log(`  Soma de saldos:     ${somaSaldos.s}`);

  // Entradas recentes do audit_log pra essas ações
  const recentes = await db
    .select()
    .from(auditLog)
    .where(sql`acao IN ('frotas_atualizar_lote', 'pecas_atualizar_lote')`)
    .orderBy(desc(auditLog.id))
    .limit(5);

  console.log(`\n  Últimas atualizações em lote (${recentes.length}):`);
  for (const r of recentes) {
    const diff = r.diff as any;
    console.log(`    #${r.id}  ${r.acao}  ${r.ts.toISOString()}`);
    console.log(`       Ator: ${r.atorNome} | ${r.resumo}`);
    if (diff) {
      console.log(
        `       Inseridos: ${diff.inseridos ?? "?"}, atualizados: ${diff.atualizados ?? "?"}, preservados: ${diff.preservadas ?? "?"}`
      );
    }
  }

  // Integridade referencial
  const orfasRows = (await db.execute(
    sql`
    WITH refs AS (
      SELECT peca_id FROM pedidos WHERE peca_id IS NOT NULL
      UNION ALL
      SELECT peca_id FROM compras WHERE peca_id IS NOT NULL
      UNION ALL
      SELECT peca_id FROM manutencao_ordens WHERE peca_id IS NOT NULL
    )
    SELECT COUNT(*)::int AS c
    FROM refs r
    WHERE NOT EXISTS (SELECT 1 FROM pecas p WHERE p.id = r.peca_id)
    `
  )) as unknown as { c: number }[];
  const refsOrfas = orfasRows[0]?.c ?? 0;
  console.log(
    `\n  Referências órfãs (pedidos/compras/OS → peça inexistente): ${refsOrfas}  ${refsOrfas === 0 ? "✓" : "✗"}`
  );

  // Cadeia de audit
  console.log("\n  Verificando cadeia de hash do audit_log…");
  const cadeia = await verificarCadeia();
  if (cadeia.ok) {
    console.log(`    ✓ Cadeia íntegra (${cadeia.total} linhas)`);
  } else {
    console.log(
      `    ✗ CADEIA QUEBRADA — divergência a partir da linha #${cadeia.primeiraDivergencia}`
    );
  }

  console.log("\n============================================================");
  const tudoOk = refsOrfas === 0 && cadeia.ok;
  console.log(tudoOk ? " ✓ TUDO OK — atualização pode ser liberada." : " ✗ ATENÇÃO — revisar antes de liberar.");
  console.log("============================================================\n");
  process.exit(tudoOk ? 0 : 1);
}

main().catch((e) => {
  console.error("[verificar] ERRO:", e);
  process.exit(1);
});
