import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { notificacoes } from "@/db/schema";
import { exigirSessaoApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await exigirSessaoApi();
  if (!auth.ok) return auth.res;
  const nome = auth.sessao.nome;

  const lista = await db
    .select()
    .from(notificacoes)
    .where(eq(notificacoes.destinatario, nome))
    .orderBy(desc(notificacoes.criadoEm))
    .limit(30);

  const [naoLidas] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(notificacoes)
    .where(
      and(eq(notificacoes.destinatario, nome), eq(notificacoes.lida, 0))
    );

  return NextResponse.json({
    notificacoes: lista,
    naoLidas: naoLidas?.c ?? 0,
  });
}
