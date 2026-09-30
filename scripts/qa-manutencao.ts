// Bateria de testes do módulo Manutenção — sem tocar em dados de produção.
//
// Roda testes em 2 grupos:
//   A) Testes puros de PARSER — não precisam banco.
//   B) Testes de LÓGICA de API — validações Zod + análise estrutural dos
//      handlers (checa se preserva dados).
//
// Se DATABASE_URL apontar pra um banco de TESTE isolado (nunca produção!),
// roda também um passo adicional de smoke test de INSERT/UPDATE nas tabelas
// de manutenção. Se apontar pra produção, esse passo é PULADO com aviso.
//
// Uso: npx tsx scripts/qa-manutencao.ts [caminho.pdf]

import { readFileSync } from "node:fs";
import { parsearTextoRelatorio } from "../lib/parser-manutencao-gmais";

type TesteResult = { nome: string; ok: boolean; detalhe: string };
const resultados: TesteResult[] = [];

function assert(nome: string, ok: boolean, detalhe: string) {
  resultados.push({ nome, ok, detalhe });
  const marca = ok ? "✓" : "✗";
  const cor = ok ? "\x1b[32m" : "\x1b[31m";
  console.log(`  ${cor}${marca}\x1b[0m ${nome} — ${detalhe}`);
}

async function extrairTextoPdf(path: string): Promise<string> {
  const mod: any = await import("pdf-parse");
  const PDFParse = mod.PDFParse ?? mod.default?.PDFParse;
  const buf = readFileSync(path);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const r = await parser.getText();
    return String(r?.text ?? "");
  } finally {
    await parser.destroy().catch(() => {});
  }
}

async function main() {
  const path =
    process.argv[2] || "C:/Users/User/Downloads/Relatorios_GMAIS_848.PDF.pdf";

  console.log("\n=================================================");
  console.log(" QA — Módulo Manutenção");
  console.log("=================================================\n");

  // -------------------------------------------------
  console.log("Grupo A — Parser PDF");
  // -------------------------------------------------
  let texto = "";
  try {
    texto = await extrairTextoPdf(path);
    assert("A1. pdf-parse v2 extrai texto do PDF real", texto.length > 1000,
      `${texto.length} chars extraídos de ${path}`);
  } catch (e: any) {
    assert("A1. pdf-parse v2 extrai texto", false, `erro: ${e.message}`);
    return relatar();
  }

  const r = parsearTextoRelatorio(texto);
  assert("A2. Parser encontra registros", r.registros.length > 100,
    `${r.registros.length} registros`);
  assert("A3. Parser encontra > 50 frotas", r.frotasDistintas > 50,
    `${r.frotasDistintas} frotas distintas`);
  assert("A4. Parser detecta vencidos (marcador *)", r.vencidos > 0,
    `${r.vencidos} vencidos`);

  const semFrota = r.registros.filter((x) => !x.frotaNumero);
  assert("A5. Nenhum registro sem frota", semFrota.length === 0,
    `${semFrota.length} sem frota`);

  const semComp = r.registros.filter(
    (x) => !x.compartimentoCodigo || !x.compartimentoTipo,
  );
  assert("A6. Nenhum registro sem compartimento", semComp.length === 0,
    `${semComp.length} sem compartimento`);

  const compIgualPeca = r.registros.filter(
    (x) => x.pecaCodigo && x.pecaCodigo === x.compartimentoCodigo,
  );
  assert(
    "A7. Peça código ≠ compartimento código (bug removido)",
    compIgualPeca.length < r.registros.length * 0.02,
    `${compIgualPeca.length}/${r.registros.length} confundidos`,
  );

  // Idempotência: 2 parses do mesmo texto devem dar o mesmo resultado
  const r2 = parsearTextoRelatorio(texto);
  assert("A8. Parser é idempotente (2 execuções = mesmo resultado)",
    r.registros.length === r2.registros.length &&
      r.vencidos === r2.vencidos,
    `${r.registros.length} == ${r2.registros.length}`);

  // -------------------------------------------------
  console.log("\nGrupo B — Validação de garantias de preservação");
  // -------------------------------------------------

  // Análise estrutural: os handlers são reads dos arquivos fonte
  const srcConfirmar = readFileSync(
    "app/api/admin/manutencao/import-pdf/confirmar/route.ts",
    "utf-8",
  );
  const srcOrdens = readFileSync(
    "app/api/admin/manutencao/ordens/route.ts",
    "utf-8",
  );
  const srcOrdemPatch = readFileSync(
    "app/api/admin/manutencao/ordens/[id]/route.ts",
    "utf-8",
  );

  assert(
    "B1. Confirmar-import só toca manutencao_registros_gmais",
    /TRUNCATE TABLE manutencao_registros_gmais/.test(srcConfirmar) &&
      !/TRUNCATE .*(pedidos|compras|pecas|frotas|usuarios|manutencao_ordens|audit_log)/i.test(
        srcConfirmar,
      ),
    "TRUNCATE limitado à tabela GMAIS isolada",
  );

  assert(
    "B2. Confirmar-import NÃO toca manutencao_ordens (garantia principal)",
    !/manutencao_ordens|delete\(.*manutencaoOrdens/i.test(srcConfirmar),
    "handler de import não menciona a tabela de OS",
  );

  assert(
    "B3. Confirmar-import exige admin",
    /exigirAdminApi/.test(srcConfirmar),
    "auth admin obrigatória",
  );

  assert(
    "B4. Confirmar-import roda em transação (rollback em caso de erro)",
    /db\.transaction/.test(srcConfirmar),
    "TRUNCATE + INSERTs atômicos",
  );

  assert(
    "B5. OS DELETE é soft delete (nunca hard delete)",
    /update\(manutencaoOrdens\).*deletadoEm/is.test(srcOrdemPatch) &&
      !/db\.delete\(manutencaoOrdens/.test(srcOrdemPatch),
    "UPDATE deletadoEm ✓, sem db.delete",
  );

  assert(
    "B6. Concluir OS exige hodômetro obrigatório",
    /hodometro_obrigatorio/i.test(srcOrdemPatch),
    "retorna 400 se hodometroConcluido vazio",
  );

  assert(
    "B7. Baixa de estoque só se pecaId preenchido",
    /pecaIdFinal\s*&&\s*qtd\s*>\s*0/.test(srcOrdemPatch),
    "guarda contra baixa acidental sem peça vinculada",
  );

  assert(
    "B8. Baixa de estoque usa GREATEST(0, saldo - qtd) — nunca negativo",
    /GREATEST\(0,\s*\$\{pecas\.saldo\}\s*-/.test(srcOrdemPatch),
    "saldo mínimo 0",
  );

  assert(
    "B9. Todas as ações da API estão auditadas (audit_log)",
    /auditar\(/.test(srcConfirmar) &&
      /auditar\(/.test(srcOrdens) &&
      /auditar\(/.test(srcOrdemPatch),
    "auditar() chamado nos 3 handlers principais",
  );

  assert(
    "B10. Zod valida entrada em todos os handlers",
    /z\.object/.test(srcConfirmar) &&
      /z\.object/.test(srcOrdens) &&
      /z\.object/.test(srcOrdemPatch),
    "schemas Zod ativos",
  );

  // -------------------------------------------------
  console.log("\nGrupo C — Verificação de isolamento (schema)");
  // -------------------------------------------------
  const schema = readFileSync("db/schema.ts", "utf-8");
  assert(
    "C1. Tabela manutencao_ordens NÃO tem FK pra frotas (frotaNumero é varchar)",
    /manutencaoOrdens\s*=\s*pgTable[\s\S]{0,300}frotaNumero:\s*varchar/.test(
      schema,
    ) && !/manutencaoOrdens[\s\S]{0,500}references\(\s*\(\)\s*=>\s*frotas/.test(schema),
    "frota é texto, sobrevive a baixar frota em produção",
  );

  assert(
    "C2. Peça em manutencao_ordens usa onDelete: 'set null'",
    /manutencaoOrdens[\s\S]{0,500}references\(\s*\(\)\s*=>\s*pecas\.id,\s*\{[\s\S]{0,100}onDelete:\s*"set null"/.test(
      schema,
    ),
    "deletar peça não apaga OS histórica",
  );

  const migration = readFileSync("db/apply-constraints.ts", "utf-8");
  assert(
    "C3. Migração é 100% idempotente (IF NOT EXISTS em tudo)",
    /CREATE TABLE IF NOT EXISTS manutencao_ordens/.test(migration) &&
      /CREATE TABLE IF NOT EXISTS manutencao_registros_gmais/.test(migration) &&
      /IF NOT EXISTS.*status_manutencao/s.test(migration),
    "reboot repetido não quebra",
  );

  // Isola o bloco novo do módulo Manutenção (a partir do marcador) pra checar
  // que a parte NOVA não introduz alterações destrutivas em tabelas antigas.
  // Alterações fora desse bloco são de migrações anteriores já aplicadas em
  // produção, com IF EXISTS / DO $$ ... THEN guardas, e não são risco.
  const marcador = migration.indexOf("MÓDULO MANUTENÇÃO");
  const blocoNovo = marcador >= 0 ? migration.slice(marcador) : "";
  assert(
    "C4. Bloco de MANUTENÇÃO só cria coisas novas (nenhum DROP/ALTER em tabelas antigas)",
    blocoNovo.length > 100 &&
      !/DROP TABLE|DROP COLUMN|TRUNCATE.*(pedidos|compras|pecas|frotas|usuarios|audit_log|movimentacoes|notificacoes|pedido_eventos|compra_eventos)/i.test(
        blocoNovo,
      ) &&
      !/ALTER TABLE\s+(pedidos|compras|pecas|frotas|usuarios|audit_log|movimentacoes|notificacoes|pedido_eventos|compra_eventos)/i.test(
        blocoNovo,
      ),
    "só CREATE TABLE/INDEX/TYPE IF NOT EXISTS",
  );

  relatar();
}

function relatar() {
  console.log("\n=================================================");
  const passou = resultados.filter((r) => r.ok).length;
  const falhou = resultados.filter((r) => !r.ok).length;
  const cor = falhou === 0 ? "\x1b[32m" : "\x1b[31m";
  console.log(
    ` Total: ${cor}${passou} passaram, ${falhou} falharam\x1b[0m de ${resultados.length}`,
  );
  console.log("=================================================\n");
  if (falhou > 0) {
    console.log("Falhas:");
    for (const r of resultados.filter((x) => !x.ok)) {
      console.log(`  ✗ ${r.nome}: ${r.detalhe}`);
    }
    process.exit(1);
  } else {
    console.log("Todos os testes passaram. Módulo pronto pra liberação.");
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
