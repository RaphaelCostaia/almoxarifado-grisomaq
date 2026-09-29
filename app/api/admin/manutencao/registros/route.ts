// GET — devolve o snapshot atual do GMAIS pra tela "Relatório GMAIS".
// Aceita filtros básicos: frota, comp tipo, só vencidos.
import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { manutencaoRegistrosGmais } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;

  const url = req.nextUrl;
  const q = url.searchParams.get("q")?.trim();
  const frota = url.searchParams.get("frota")?.trim();
  const compTipo = url.searchParams.get("compTipo")?.trim();
  const soVencidos = url.searchParams.get("soVencidos") === "1";

  const conds: any[] = [];
  if (q) {
    conds.push(
      or(
        ilike(manutencaoRegistrosGmais.frotaNumero, `%${q}%`),
        ilike(manutencaoRegistrosGmais.frotaModelo, `%${q}%`),
        ilike(manutencaoRegistrosGmais.compartimentoTipo, `%${q}%`),
        ilike(manutencaoRegistrosGmais.pecaNome, `%${q}%`),
        ilike(manutencaoRegistrosGmais.pecaCodigo, `%${q}%`)
      )
    );
  }
  if (frota) conds.push(eq(manutencaoRegistrosGmais.frotaNumero, frota));
  if (compTipo) conds.push(ilike(manutencaoRegistrosGmais.compartimentoTipo, `%${compTipo}%`));
  if (soVencidos) conds.push(eq(manutencaoRegistrosGmais.vencido, 1));

  const rows = await db
    .select()
    .from(manutencaoRegistrosGmais)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(
      asc(manutencaoRegistrosGmais.frotaNumero),
      asc(manutencaoRegistrosGmais.compartimentoCodigo)
    )
    .limit(5000);

  const [meta] = await db
    .select({
      total: sql<number>`count(*)::int`,
      vencidos: sql<number>`sum(vencido)::int`,
      frotas: sql<number>`count(distinct frota_numero)::int`,
      importadoEm: sql<string | null>`max(importado_em)::text`,
    })
    .from(manutencaoRegistrosGmais);

  return NextResponse.json({ registros: rows, resumo: meta });
}
