import { NextResponse } from "next/server";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pedidos } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const naoDeletado = isNull(pedidos.deletadoEm);

  const emAberto = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(pedidos)
    .where(
      and(naoDeletado, sql`${pedidos.status} NOT IN ('entregue','cancelada')`)
    );

  const urgentes = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(pedidos)
    .where(
      and(
        naoDeletado,
        eq(pedidos.prioridade, "urgente"),
        sql`${pedidos.status} NOT IN ('entregue','cancelada')`
      )
    );

  const emAtraso = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(pedidos)
    .where(
      and(
        naoDeletado,
        sql`${pedidos.status} NOT IN ('entregue','cancelada')`,
        sql`${pedidos.atualizadoEm} < now() - interval '2 days'`
      )
    );

  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
  const entregues = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(pedidos)
    .where(
      and(
        naoDeletado,
        eq(pedidos.status, "entregue"),
        gte(pedidos.entregueEm, seteDiasAtras)
      )
    );

  return NextResponse.json({
    emAberto: emAberto[0]?.c ?? 0,
    urgentes: urgentes[0]?.c ?? 0,
    emAtraso: emAtraso[0]?.c ?? 0,
    entregues7d: entregues[0]?.c ?? 0,
  });
}
