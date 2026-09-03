import { NextRequest } from "next/server";
import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { toCSV } from "@/lib/csv";
import { formatBR } from "@/lib/date";
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

  const rows = await db
    .select()
    .from(auditLog)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLog.id))
    .limit(50000); // guarda contra export gigantesco

  const csv = toCSV(
    rows.map((r) => ({
      ID: r.id,
      Data: formatBR(r.ts),
      Ator: r.atorNome ?? "",
      AtorRole: r.atorRole ?? "",
      Acao: r.acao,
      Entidade: r.entidade ?? "",
      EntidadeId: r.entidadeId ?? "",
      Resumo: r.resumo,
      IP: r.ip ?? "",
      UserAgent: r.userAgent ?? "",
      RequestId: r.requestId ?? "",
      HashPrev: r.hashPrev,
      HashCurr: r.hashCurr,
      Diff: r.diff ? JSON.stringify(r.diff) : "",
    }))
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria-grisomaq-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
