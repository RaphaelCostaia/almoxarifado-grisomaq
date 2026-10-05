// Dry-run: compara db/seed-pecas.json com a tabela pecas em produção.
// NÃO escreve nada. Gera relatorio-diff-pecas.json e imprime resumo.
//
// Uso: npx tsx --env-file=.env.local scripts/diff-pecas.ts
// Pré-requisito: python scripts/gerar-seed-pecas.py <xlsx>
//
// IMPORTANTE: a coluna `saldo` NUNCA é comparada nem atualizada em peças
// existentes — o saldo da planilha é só saldo inicial em peças NOVAS.
// Campos operacionais (`minimo`, `maximo`, `localizacao`) também são
// preservados em peças existentes.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isNull } from "drizzle-orm";
import { db } from "../db/client-admin";
import { pecas } from "../db/schema";

type PecaJson = {
  codigo: string;
  nome: string;
  unidade: string;
  saldo: string;
  familia: string | null;
  codigoFabricante: string | null;
  codigoParalelo: string | null;
};

// Campos que o diff compara/atualiza em peças existentes.
// NOTA DELIBERADA: `saldo`, `minimo`, `maximo`, `localizacao` NÃO estão
// aqui — são campos operacionais e não devem ser tocados por import.
const CAMPOS_COMPARAVEIS: (keyof PecaJson)[] = [
  "nome",
  "unidade",
  "familia",
  "codigoFabricante",
  "codigoParalelo",
];

type DiffEntry = {
  codigo: string;
  campos: Record<string, { antes: unknown; depois: unknown }>;
};

type Relatorio = {
  geradoEm: string;
  totalBanco: number;
  totalJson: number;
  inserir: PecaJson[];
  atualizar: DiffEntry[];
  inalterados: number;
  apenasNoBanco: { codigo: string | null; nome: string; saldo: string }[];
  campoSaldoPreservado: true;
};

function normalizar(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function main() {
  const jsonPath = join(process.cwd(), "db", "seed-pecas.json");
  const raw = readFileSync(jsonPath, "utf-8");
  const novas: PecaJson[] = JSON.parse(raw);

  console.log(`[diff-pecas] Lendo ${novas.length} registros do JSON.`);

  const existentes = await db
    .select()
    .from(pecas)
    .where(isNull(pecas.deletadoEm));

  console.log(`[diff-pecas] Banco tem ${existentes.length} peças ativas.`);

  const porCodigoBanco = new Map<string, (typeof existentes)[number]>();
  for (const p of existentes) {
    if (p.codigo) porCodigoBanco.set(p.codigo, p);
  }

  const codigosJson = new Set(novas.map((n) => n.codigo));

  const inserir: PecaJson[] = [];
  const atualizar: DiffEntry[] = [];
  let inalterados = 0;

  for (const nova of novas) {
    const atual = porCodigoBanco.get(nova.codigo);
    if (!atual) {
      inserir.push(nova);
      continue;
    }
    const campos: DiffEntry["campos"] = {};
    for (const c of CAMPOS_COMPARAVEIS) {
      const antes = normalizar((atual as any)[c]);
      const depois = normalizar(nova[c]);
      if (antes !== depois) {
        campos[c] = { antes, depois };
      }
    }
    if (Object.keys(campos).length === 0) {
      inalterados++;
    } else {
      atualizar.push({ codigo: nova.codigo, campos });
    }
  }

  const apenasNoBanco = existentes
    .filter((p) => !p.codigo || !codigosJson.has(p.codigo))
    .map((p) => ({ codigo: p.codigo, nome: p.nome, saldo: p.saldo as string }));

  const relatorio: Relatorio = {
    geradoEm: new Date().toISOString(),
    totalBanco: existentes.length,
    totalJson: novas.length,
    inserir,
    atualizar,
    inalterados,
    apenasNoBanco,
    campoSaldoPreservado: true,
  };

  const saida = join(process.cwd(), "relatorio-diff-pecas.json");
  writeFileSync(saida, JSON.stringify(relatorio, null, 2), "utf-8");

  console.log("\n============================================================");
  console.log(" RELATÓRIO DE DIFERENÇAS — PEÇAS");
  console.log("============================================================");
  console.log(`  Inserir (novas no JSON):           ${inserir.length}`);
  console.log(`  Atualizar (catálogo mudou):        ${atualizar.length}`);
  console.log(`  Inalteradas:                       ${inalterados}`);
  console.log(`  Apenas no banco (serão mantidas):  ${apenasNoBanco.length}`);
  console.log(`  Saldo preservado em peças existentes: SIM (nunca sobrescreve)`);
  console.log("------------------------------------------------------------");

  if (inserir.length > 0) {
    console.log("\n  Amostra inserir (até 10):");
    for (const i of inserir.slice(0, 10)) {
      console.log(`    + ${i.codigo}  ${i.nome.slice(0, 60)}`);
    }
  }
  if (atualizar.length > 0) {
    console.log("\n  Amostra atualizar (até 10):");
    for (const u of atualizar.slice(0, 10)) {
      const resumo = Object.entries(u.campos)
        .map(([k, v]) => `${k}: ${JSON.stringify(v.antes)} → ${JSON.stringify(v.depois)}`)
        .join(" | ");
      console.log(`    ~ ${u.codigo}  [${resumo}]`);
    }
  }
  if (apenasNoBanco.length > 0) {
    console.log("\n  Amostra apenas no banco (até 10, serão PRESERVADAS):");
    for (const b of apenasNoBanco.slice(0, 10)) {
      console.log(`    = ${b.codigo ?? "(sem código)"}  saldo=${b.saldo}  ${b.nome.slice(0, 50)}`);
    }
  }

  console.log(`\n[diff-pecas] Relatório completo salvo em: ${saida}`);
  console.log("[diff-pecas] Pra aplicar, rode: npm run atualizar:pecas -- --apply");
  process.exit(0);
}

main().catch((e) => {
  console.error("[diff-pecas] ERRO:", e);
  process.exit(1);
});
