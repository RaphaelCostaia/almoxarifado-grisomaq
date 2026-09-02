import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { frotas } from "@/db/schema";
import { exigirSessaoApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await exigirSessaoApi();
  if (!auth.ok) return auth.res;

  const url = req.nextUrl;
  const q = url.searchParams.get("q")?.trim();
  const ativos = url.searchParams.get("ativos") !== "0";
  const limit = Math.min(50, Number(url.searchParams.get("limit") ?? 20));

  const conds: any[] = [];
  if (ativos) conds.push(eq(frotas.ativo, 1));
  if (q) {
    conds.push(
      or(
        ilike(frotas.numero, `${q}%`),
        ilike(frotas.numero, `%${q}%`),
        ilike(frotas.modelo, `%${q}%`),
        ilike(frotas.marca, `%${q}%`),
        ilike(frotas.descricao, `%${q}%`),
        ilike(frotas.placa, `%${q}%`)
      )
    );
  }

  // Ordena: match no numero primeiro (mais relevante), depois modelo
  const rows = await db
    .select()
    .from(frotas)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(
      sql`CASE WHEN ${frotas.numero} = ${q ?? ""} THEN 0
               WHEN ${frotas.numero} ILIKE ${q ? q + "%" : ""} THEN 1
               ELSE 2 END`,
      frotas.categoria,
      frotas.numero
    )
    .limit(limit);

  return NextResponse.json({ frotas: rows });
}
