// Dry-run: compara db/seed-frotas.json com a tabela frotas em produção
// (ou em qualquer banco apontado por POSTGRES_URL / POSTGRES_URL_ADMIN).
//
// NÃO ESCREVE NADA no banco — apenas gera relatorio-diff-frotas.json e imprime
// um resumo pra admin inspecionar antes de aplicar.
//
// Uso: npx tsx --env-file=.env.local scripts/diff-frotas.ts
// Pré-requisito: rodar antes `python scripts/gerar-seed-frotas.py <xlsx>`
//
// Categorias:
//   inserir       — numero no JSON e NÃO no banco
//   atualizar     — numero em ambos, ao menos um campo de catálogo mudou
//   inalterados   — tudo igual
//   apenas_no_banco — numero no banco e NÃO no JSON (serão mantidos intactos)

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isNull, sql } from "drizzle-orm";
import { db } from "../db/client-admin";
import { frotas } from "../db/schema";

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

// Campos que o diff compara/atualiza. Nunca inclui id, numero, criadoEm,
// deletadoEm, deletadoPor.
const CAMPOS_COMPARAVEIS: (keyof FrotaJson)[] = [
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
];

type DiffEntry = {
  numero: string;
  campos: Record<string, { antes: unknown; depois: unknown }>;
};

type Relatorio = {
  geradoEm: string;
  totalBanco: number;
  totalJson: number;
  inserir: FrotaJson[];
  atualizar: DiffEntry[];
  inalterados: number;
  apenasNoBanco: { numero: string; categoria: string; modelo: string | null }[];
};

function normalizar(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function main() {
  const jsonPath = join(process.cwd(), "db", "seed-frotas.json");
  const raw = readFileSync(jsonPath, "utf-8");
  const novas: FrotaJson[] = JSON.parse(raw);

  console.log(`[diff-frotas] Lendo ${novas.length} registros do JSON.`);

  const existentes = await db
    .select()
    .from(frotas)
    .where(isNull(frotas.deletadoEm));

  console.log(`[diff-frotas] Banco tem ${existentes.length} frotas ativas (deletadoEm IS NULL).`);

  const porNumeroBanco = new Map<string, (typeof existentes)[number]>();
  for (const f of existentes) porNumeroBanco.set(f.numero, f);

  const numerosJson = new Set(novas.map((n) => n.numero));

  const inserir: FrotaJson[] = [];
  const atualizar: DiffEntry[] = [];
  let inalterados = 0;

  for (const nova of novas) {
    const atual = porNumeroBanco.get(nova.numero);
    if (!atual) {
      inserir.push(nova);
      continue;
    }
    const campos: DiffEntry["campos"] = {};
    for (const c of CAMPOS_COMPARAVEIS) {
      const antes = c === "ativo" ? atual[c] : normalizar(atual[c as keyof typeof atual]);
      const depois = c === "ativo" ? nova[c] : normalizar(nova[c]);
      if (antes !== depois) {
        campos[c] = { antes, depois };
      }
    }
    if (Object.keys(campos).length === 0) {
      inalterados++;
    } else {
      atualizar.push({ numero: nova.numero, campos });
    }
  }

  const apenasNoBanco = existentes
    .filter((f) => !numerosJson.has(f.numero))
    .map((f) => ({ numero: f.numero, categoria: f.categoria, modelo: f.modelo }));

  const relatorio: Relatorio = {
    geradoEm: new Date().toISOString(),
    totalBanco: existentes.length,
    totalJson: novas.length,
    inserir,
    atualizar,
    inalterados,
    apenasNoBanco,
  };

  const saida = join(process.cwd(), "relatorio-diff-frotas.json");
  writeFileSync(saida, JSON.stringify(relatorio, null, 2), "utf-8");

  console.log("\n============================================================");
  console.log(" RELATÓRIO DE DIFERENÇAS — FROTAS");
  console.log("============================================================");
  console.log(`  Inserir (novas no JSON):           ${inserir.length}`);
  console.log(`  Atualizar (campos mudaram):        ${atualizar.length}`);
  console.log(`  Inalteradas:                       ${inalterados}`);
  console.log(`  Apenas no banco (serão mantidas):  ${apenasNoBanco.length}`);
  console.log("------------------------------------------------------------");

  if (inserir.length > 0) {
    console.log("\n  Amostra inserir (até 10):");
    for (const i of inserir.slice(0, 10)) {
      console.log(`    + ${i.numero}  ${i.modelo ?? ""}`);
    }
  }
  if (atualizar.length > 0) {
    console.log("\n  Amostra atualizar (até 10):");
    for (const u of atualizar.slice(0, 10)) {
      const resumoCampos = Object.entries(u.campos)
        .map(([k, v]) => `${k}: ${JSON.stringify(v.antes)} → ${JSON.stringify(v.depois)}`)
        .join(" | ");
      console.log(`    ~ ${u.numero}  [${resumoCampos}]`);
    }
  }
  if (apenasNoBanco.length > 0) {
    console.log("\n  Amostra apenas no banco (até 10, serão PRESERVADAS):");
    for (const b of apenasNoBanco.slice(0, 10)) {
      console.log(`    = ${b.numero}  (${b.categoria})  ${b.modelo ?? ""}`);
    }
  }

  console.log(`\n[diff-frotas] Relatório completo salvo em: ${saida}`);
  console.log("[diff-frotas] Pra aplicar, rode: npm run atualizar:frotas -- --apply");
  process.exit(0);
}

main().catch((e) => {
  console.error("[diff-frotas] ERRO:", e);
  process.exit(1);
});
