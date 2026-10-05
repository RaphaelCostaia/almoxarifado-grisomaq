// Aplica relatorio-diff-frotas.json no banco.
// Exige --apply pra realmente commitar; sem flag, só diz o que faria.
// Transação única: ou tudo entra, ou nada entra.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/aplicar-diff-frotas.ts            (seco, só preview)
//   npx tsx --env-file=.env.local scripts/aplicar-diff-frotas.ts --apply    (aplica)

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client-admin";
import { frotas } from "../db/schema";
import { auditarCli } from "./lib-auditar-cli";

const CAMPOS_WHITELIST = [
  "categoria",
  "modelo",
  "marca",
  "descricao",
  "ano",
  "placa",
  "chassi",
  "localizacao",
  "proprietario",
  "ativo",
  "observacoes",
] as const;

type Relatorio = {
  geradoEm: string;
  totalBanco: number;
  totalJson: number;
  inserir: any[];
  atualizar: { numero: string; campos: Record<string, { antes: unknown; depois: unknown }> }[];
  inalterados: number;
  apenasNoBanco: any[];
};

function checarBackupRecente(): { ok: boolean; motivo?: string } {
  // Só força check se BACKUP_DIR estiver setado e existir /data/backups/
  const dir = process.env.BACKUP_DIR ?? "/data/backups";
  try {
    const st = statSync(dir);
    if (!st.isDirectory()) return { ok: true };
  } catch {
    // Diretório não existe (dev local). Não bloqueia.
    return { ok: true };
  }
  // Procura arquivo recente (<= 24h) via mtime do diretório
  try {
    const now = Date.now();
    const mt = statSync(dir).mtime.getTime();
    const idadeHoras = (now - mt) / 1000 / 3600;
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
  const atorNome = process.env.ATOR_NOME ?? "cli-atualizacao-frotas";

  const relPath = join(process.cwd(), "relatorio-diff-frotas.json");
  const rel: Relatorio = JSON.parse(readFileSync(relPath, "utf-8"));

  console.log("\n============================================================");
  console.log(" APLICAR DIFF — FROTAS");
  console.log("============================================================");
  console.log(`  Gerado em:                         ${rel.geradoEm}`);
  console.log(`  A inserir:                         ${rel.inserir.length}`);
  console.log(`  A atualizar:                       ${rel.atualizar.length}`);
  console.log(`  Inalteradas (não tocamos):         ${rel.inalterados}`);
  console.log(`  Apenas no banco (preservadas):     ${rel.apenasNoBanco.length}`);

  if (!apply) {
    console.log("\n[aplicar-frotas] MODO DRY-RUN. Nada será gravado.");
    console.log("[aplicar-frotas] Pra aplicar: npm run atualizar:frotas -- --apply");
    process.exit(0);
  }

  const backup = checarBackupRecente();
  if (!backup.ok) {
    console.error(`[aplicar-frotas] ABORTADO: ${backup.motivo}`);
    process.exit(2);
  }

  // Pré-contagem
  const [antesCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(frotas);
  const antes = antesCount.c;
  console.log(`[aplicar-frotas] Contagem antes: ${antes}`);

  await db.transaction(async (tx) => {
    let inseridos = 0;
    const batchSize = 50;
    for (let i = 0; i < rel.inserir.length; i += batchSize) {
      const batch = rel.inserir.slice(i, i + batchSize);
      const r = await tx
        .insert(frotas)
        .values(batch as any)
        .onConflictDoNothing({ target: frotas.numero })
        .returning({ id: frotas.id });
      inseridos += r.length;
    }

    let atualizados = 0;
    for (const u of rel.atualizar) {
      const patch: Record<string, unknown> = {};
      for (const [campo, v] of Object.entries(u.campos)) {
        if (!CAMPOS_WHITELIST.includes(campo as any)) continue;
        patch[campo] = v.depois;
      }
      if (Object.keys(patch).length === 0) continue;
      await tx
        .update(frotas)
        .set(patch as any)
        .where(eq(frotas.numero, u.numero));
      atualizados++;
    }

    // Pós-checks dentro da transação — qualquer falha rolla back tudo
    const [depoisCount] = await tx
      .select({ c: sql<number>`count(*)::int` })
      .from(frotas);
    if (depoisCount.c < antes) {
      throw new Error(
        `pós-check falhou: contagem caiu (${antes} → ${depoisCount.c}). Rollback.`
      );
    }

    // Audit log — dentro da mesma transação, hash-chain preservado
    const amostraUpdates = rel.atualizar.slice(0, 20);
    await auditarCli(tx, {
      acao: "frotas_atualizar_lote",
      entidade: "frota",
      resumo: `Atualização em lote: ${inseridos} inseridas, ${atualizados} atualizadas, ${rel.apenasNoBanco.length} preservadas.`,
      diff: {
        geradoEm: rel.geradoEm,
        inseridos,
        atualizados,
        preservadas: rel.apenasNoBanco.length,
        inalteradas: rel.inalterados,
        amostra_updates: amostraUpdates,
      },
      atorNome,
    });

    console.log(`[aplicar-frotas] Inseridos: ${inseridos}, atualizados: ${atualizados}`);
    console.log(`[aplicar-frotas] Preservadas (apenas no banco): ${rel.apenasNoBanco.length}`);
    console.log(`[aplicar-frotas] Contagem depois: ${depoisCount.c}`);
  });

  console.log("[aplicar-frotas] ✓ Transação commitada com sucesso.");
  process.exit(0);
}

main().catch((e) => {
  console.error("[aplicar-frotas] ERRO (rollback aplicado):", e);
  process.exit(1);
});
