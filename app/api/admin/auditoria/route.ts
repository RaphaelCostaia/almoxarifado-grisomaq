import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;

  const url = req.nextUrl;
  const q = url.searchParams.get("q")?.trim();
  const acao = url.searchParams.get("acao")?.trim();
  const entidade = url.searchParams.get("entidade")?.trim();
  const ator = url.searchParams.get("ator")?.trim();
  const de = url.searchParams.get("de");
  const ate = url.searchParams.get("ate");
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

  const conds: any[] = [];
  if (q) {
    conds.push(
      or(
        ilike(auditLog.resumo, `%${q}%`),
        ilike(auditLog.atorNome, `%${q}%`),
        ilike(auditLog.ip, `%${q}%`)
      )
    );
  }
  if (acao && acao !== "todas") conds.push(eq(auditLog.acao, acao));
  if (entidade && entidade !== "todas") conds.push(eq(auditLog.entidade, entidade));
  if (ator) conds.push(ilike(auditLog.atorNome, `%${ator}%`));
  if (de) conds.push(gte(auditLog.ts, new Date(`${de}T00:00:00`)));
  if (ate) conds.push(lte(auditLog.ts, new Date(`${ate}T23:59:59`)));

  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select()
    .from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.id))
    .limit(limit)
    .offset(offset);

  const [total] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(where);

  return NextResponse.json({
    log: rows,
    total: total?.c ?? 0,
    limit,
    offset,
  });
}
