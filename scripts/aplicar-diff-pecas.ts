// Aplica relatorio-diff-pecas.json no banco.
// Pós-check CRÍTICO: soma de saldos NÃO pode mudar (nunca atualizamos saldo
// de peça existente — só saldo inicial em peças novas).
//
// Uso:
//   npx tsx --env-file=.env.local scripts/aplicar-diff-pecas.ts            (seco)
//   npx tsx --env-file=.env.local scripts/aplicar-diff-pecas.ts --apply    (aplica)

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client-admin";
import { pecas } from "../db/schema";
import { auditarCli } from "./lib-auditar-cli";

// Whitelist estrita — campos operacionais (saldo, minimo, maximo, localizacao)
// NÃO estão aqui e não serão tocados.
const CAMPOS_WHITELIST = [
  "nome",
  "unidade",
  "familia",
  "codigoFabricante",
  "codigoParalelo",
] as const;

type Relatorio = {
  geradoEm: string;
  totalBanco: number;
  totalJson: number;
  inserir: any[];
  atualizar: { codigo: string; campos: Record<string, { antes: unknown; depois: unknown }> }[];
  inalterados: number;
  apenasNoBanco: any[];
};

function checarBackupRecente(): { ok: boolean; motivo?: string } {
  const dir = process.env.BACKUP_DIR ?? "/data/backups";
  try {
    const st = statSync(dir);
    if (!st.isDirectory()) return { ok: true };
  } catch {
    return { ok: true };
  }
  try {
    const idadeHoras = (Date.now() - statSync(dir).mtime.getTime()) / 3600_000;
    if (idadeHoras > 24) {
      return {
        ok: false,
        motivo: `Último backup em ${dir} tem ${idadeHoras.toFixed(1)}h (> 24h). Dispare backup manual antes.`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const atorNome = process.env.ATOR_NOME ?? "cli-atualizacao-pecas";

  const relPath = join(process.cwd(), "relatorio-diff-pecas.json");
  const rel: Relatorio = JSON.parse(readFileSync(relPath, "utf-8"));

  console.log("\n============================================================");
  console.log(" APLICAR DIFF — PEÇAS");
  console.log("============================================================");
  console.log(`  Gerado em:                              ${rel.geradoEm}`);
  console.log(`  A inserir (novas):                      ${rel.inserir.length}`);
  console.log(`  A atualizar (catálogo):                 ${rel.atualizar.length}`);
  console.log(`  Inalteradas:                            ${rel.inalterados}`);
  console.log(`  Apenas no banco (preservadas):          ${rel.apenasNoBanco.length}`);
  console.log(`  Saldo preservado em peças existentes:   SIM`);

  if (!apply) {
    console.log("\n[aplicar-pecas] MODO DRY-RUN. Nada será gravado.");
    console.log("[aplicar-pecas] Pra aplicar: npm run atualizar:pecas -- --apply");
    process.exit(0);
  }

  const backup = checarBackupRecente();
  if (!backup.ok) {
    console.error(`[aplicar-pecas] ABORTADO: ${backup.motivo}`);
    process.exit(2);
  }

  // Pré-contagem + soma de saldos das peças EXISTENTES (ativas).
  // Guardamos a soma pra garantir que ela não muda depois do UPDATE
  // (quem muda saldo é operação, não import).
  const [antesCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(pecas);
  const [antesSoma] = await db
    .select({ s: sql<string>`COALESCE(SUM(saldo), 0)::text` })
    .from(pecas)
    .where(isNull(pecas.deletadoEm));
  const antes = antesCount.c;
  const somaAntes = antesSoma.s;
  console.log(`[aplicar-pecas] Contagem antes: ${antes}, soma saldos: ${somaAntes}`);

  await db.transaction(async (tx) => {
    // IDs das peças já existentes antes de qualquer insert. Soma de saldos
    // dessas tem que continuar igual depois.
    const existentesAntes = await tx
      .select({ id: pecas.id, saldo: pecas.saldo })
      .from(pecas)
      .where(isNull(pecas.deletadoEm));
    const idsExistentes = existentesAntes.map((p) => p.id);
    const somaExistentesAntes = existentesAntes.reduce(
      (acc, p) => acc + Number(p.saldo),
      0
    );

    // INSERTs em lote (peças novas levam saldo inicial da planilha)
    let inseridos = 0;
    const batchSize = 200;
    for (let i = 0; i < rel.inserir.length; i += batchSize) {
      const batch = rel.inserir.slice(i, i + batchSize);
      const r = await tx
        .insert(pecas)
        .values(batch as any)
        .onConflictDoNothing({ target: pecas.codigo })
        .returning({ id: pecas.id });
      inseridos += r.length;
    }

    // UPDATEs com whitelist — nunca inclui saldo
    let atualizados = 0;
    for (const u of rel.atualizar) {
      const patch: Record<string, unknown> = {};
      for (const [campo, v] of Object.entries(u.campos)) {
        if (!CAMPOS_WHITELIST.includes(campo as any)) continue;
        patch[campo] = v.depois;
      }
      if (Object.keys(patch).length === 0) continue;
      await tx
        .update(pecas)
        .set(patch as any)
        .where(eq(pecas.codigo, u.codigo));
      atualizados++;
    }

    // PÓS-CHECK 1: soma de saldos das peças que já existiam continua igual
    if (idsExistentes.length > 0) {
      const [somaDepois] = await tx
        .select({ s: sql<string>`COALESCE(SUM(saldo), 0)::text` })
        .from(pecas)
        .where(sql`id = ANY(${idsExistentes})`);
      const diff = Math.abs(Number(somaDepois.s) - somaExistentesAntes);
      if (diff > 0.001) {
        throw new Error(
          `pós-check falhou: soma de saldos das peças pré-existentes mudou (${somaExistentesAntes} → ${somaDepois.s}). Rollback.`
        );
      }
    }

    // PÓS-CHECK 2: contagem total só pode crescer ou ficar igual
    const [depoisCount] = await tx
      .select({ c: sql<number>`count(*)::int` })
      .from(pecas);
    if (depoisCount.c < antes) {
      throw new Error(
        `pós-check falhou: contagem total caiu (${antes} → ${depoisCount.c}). Rollback.`
      );
    }

    // PÓS-CHECK 3: nenhum pedido/compra/OS deve apontar pra peca_id inválido
    const refsRows = (await tx.execute(
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
    const refsOrfasC = refsRows[0]?.c ?? 0;
    if (refsOrfasC > 0) {
      throw new Error(
        `pós-check falhou: ${refsOrfasC} referências órfãs para pecas.id. Rollback.`
      );
    }

    const amostraUpdates = rel.atualizar.slice(0, 20);
    await auditarCli(tx, {
      acao: "pecas_atualizar_lote",
      entidade: "peca",
      resumo: `Atualização em lote: ${inseridos} inseridas, ${atualizados} atualizadas, ${rel.apenasNoBanco.length} preservadas. Saldo não alterado.`,
      diff: {
        geradoEm: rel.geradoEm,
        inseridos,
        atualizados,
        preservadas: rel.apenasNoBanco.length,
        inalteradas: rel.inalterados,
        soma_saldos_existentes_antes: somaExistentesAntes,
        amostra_updates: amostraUpdates,
      },
      atorNome,
    });

    console.log(`[aplicar-pecas] Inseridos: ${inseridos}, atualizados: ${atualizados}`);
    console.log(`[aplicar-pecas] Preservadas (apenas no banco): ${rel.apenasNoBanco.length}`);
    console.log(`[aplicar-pecas] Contagem depois: ${depoisCount.c}`);
    console.log(`[aplicar-pecas] Soma de saldos existentes: ${somaExistentesAntes} (inalterada)`);
  });

  console.log("[aplicar-pecas] ✓ Transação commitada com sucesso.");
  process.exit(0);
}

main().catch((e) => {
  console.error("[aplicar-pecas] ERRO (rollback aplicado):", e);
  process.exit(1);
});
