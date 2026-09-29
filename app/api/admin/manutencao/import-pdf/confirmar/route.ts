// POST — grava (upsert) o snapshot do relatório GMAIS.
// Estratégia: em uma transação, apaga tudo com mesmo (frota_numero,
// compartimento_codigo) e reinsere. Assim reimportar substitui.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { manutencaoRegistrosGmais } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";
import { auditar } from "@/lib/auditar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RegistroSchema = z.object({
  frotaNumero: z.string().min(1).max(64),
  frotaModelo: z.string().max(128).nullable().optional(),
  compartimentoCodigo: z.string().max(16),
  compartimentoTipo: z.string().max(64),
  ultimaTrocaData: z.string().max(16).nullable().optional(),
  ultimaTrocaHodometro: z.string().max(32).nullable().optional(),
  kmIntervalo: z.string().max(32).nullable().optional(),
  hodometroAtual: z.string().max(32).nullable().optional(),
  kmFaltando: z.string().max(32).nullable().optional(),
  diasFaltando: z.string().max(16).nullable().optional(),
  pecaCodigo: z.string().max(64).nullable().optional(),
  pecaNome: z.string().max(255).nullable().optional(),
  capacidade: z.string().max(32).nullable().optional(),
  vencido: z.boolean(),
});
const Schema = z.object({
  registros: z.array(RegistroSchema).min(1).max(20000),
});

export async function POST(req: NextRequest) {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "dados_invalidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const importadoPor = auth.sessao.nome;
  const registros = parsed.data.registros;

  await db.transaction(async (tx) => {
    // Substitui snapshot inteiro: apaga tudo e reinsere.
    // A tabela é isolada (só o módulo Manutenção usa). Sem risco.
    await tx.execute(sql`TRUNCATE TABLE manutencao_registros_gmais`);
    // Insere em lotes pra caber em 1 SQL grande
    const batchSize = 200;
    for (let i = 0; i < registros.length; i += batchSize) {
      const batch = registros.slice(i, i + batchSize).map((r) => ({
        ...r,
        vencido: r.vencido ? 1 : 0,
        importadoPor,
      }));
      await tx.insert(manutencaoRegistrosGmais).values(batch as any);
    }
  });

  const vencidos = registros.filter((r) => r.vencido).length;
  const frotas = new Set(registros.map((r) => r.frotaNumero)).size;

  await auditar({
    req,
    sessao: auth.sessao,
    acao: "manutencao_import_pdf_confirmado",
    entidade: "manutencao",
    resumo: `Snapshot GMAIS atualizado: ${registros.length} linhas, ${vencidos} vencidos, ${frotas} frotas`,
    diff: { linhas: registros.length, vencidos, frotas },
  });

  return NextResponse.json({
    ok: true,
    inseridos: registros.length,
    vencidos,
    frotas,
  });
}
