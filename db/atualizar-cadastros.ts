// Aplica um pacote de atualização (db/atualizacoes/<data>/) gerado por
// scripts/gerar-atualizacao-cadastros.py. Roda no console do container do app:
//
//   npx --no-install tsx db/atualizar-cadastros.ts db/atualizacoes/2026-11-24            -> prévia (não grava)
//   npx --no-install tsx db/atualizar-cadastros.ts db/atualizacoes/2026-11-24 --aplicar  -> backup + grava
//
// Regras de segurança em db/atualizar-cadastros-lib.ts.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { db } from "./client-admin";
import { executar, type Plano } from "./atualizar-cadastros-lib";

function ler<T>(pasta: string, nome: string): T[] | undefined {
  const arq = join(pasta, nome);
  return existsSync(arq) ? (JSON.parse(readFileSync(arq, "utf-8")) as T[]) : undefined;
}

function backup(): string {
  const url = process.env.POSTGRES_URL_ADMIN ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL não definida.");
  const dir = join(process.env.BACKUP_DIR ?? "/data/backups", "db");
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const arq = join(dir, `pre-atualizacao-${ts}.dump`);
  execFileSync("pg_dump", [url, "-Fc", "-f", arq], { stdio: "inherit" });
  const tam = statSync(arq).size;
  if (tam < 1024) throw new Error(`Backup suspeito (${tam} bytes) em ${arq}.`);
  return `${arq} (${(tam / 1024 / 1024).toFixed(1)} MB)`;
}

function imprimir(titulo: string, p: Plano<unknown> | undefined) {
  if (!p) return;
  console.log(`\n=== ${titulo} ===`);
  console.log(`  novos:              ${p.inserir.length}`);
  console.log(`  atualizados:        ${p.atualizar.length}`);
  console.log(`  iguais:             ${p.iguais}`);
  console.log(`  só no sistema:      ${p.soNoSistema} (ficam intactos)`);
  console.log(`  ignorados:          ${p.ignorados.length}`);
  console.log(`  brancos preservados:${p.vaziosPreservados} (campo vazio na planilha não apagou dado do sistema)`);
  for (const a of p.atualizar.slice(0, 8)) {
    const m = Object.entries(a.mudancas).map(([c, [x, y]]) => `${c}: ${x ?? "∅"} → ${y}`).join(" | ");
    console.log(`    ~ ${a.chave}  ${m}`);
  }
  if (p.atualizar.length > 8) console.log(`    … e mais ${p.atualizar.length - 8}`);
  const desat = p.atualizar.filter((a) => a.mudancas.ativo?.[1] === 0).map((a) => a.chave);
  if (desat.length) console.log(`  ATENÇÃO — ficam inativos (somem do pedido): ${desat.join(", ")}`);
  for (const i of p.ignorados.slice(0, 20)) console.log(`    ! ${i.chave}: ${i.motivo}`);
  if (p.ignorados.length > 20) console.log(`    … e mais ${p.ignorados.length - 20}`);
}

async function main() {
  const pasta = process.argv[2];
  const aplicar = process.argv.includes("--aplicar");
  if (!pasta || !existsSync(pasta)) {
    console.error("Uso: npx --no-install tsx db/atualizar-cadastros.ts <pasta-do-pacote> [--aplicar]");
    process.exit(2);
  }
  const dados = {
    frotas: ler<any>(pasta, "frotas.json"),
    agregados: ler<any>(pasta, "agregados.json"),
    pecas: ler<any>(pasta, "pecas.json"),
  };

  if (aplicar) console.log(`[atualizar] Backup antes de gravar: ${backup()}`);

  const res = await executar(db, dados, { aplicar, ator: `cli-atualizacao-${pasta.split(/[\\/]/).pop()}` });
  imprimir("FROTAS (equipamentos)", res.frotas);
  imprimir("AGREGADOS", res.agregados);
  imprimir("PEÇAS", res.pecas);
  console.log(
    res.aplicado
      ? "\n[atualizar] ✓ Gravado numa única transação. Registro na Auditoria."
      : "\n[atualizar] PRÉVIA — nada foi gravado. Para gravar, rode de novo com --aplicar."
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("\n[atualizar] ERRO — nada foi gravado (transação desfeita):", e?.message ?? e);
  process.exit(1);
});
