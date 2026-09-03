import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pecas, movimentacoes } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";
import { auditar } from "@/lib/auditar";
import type { AuditAcao } from "@/lib/audit-acoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  tipo: z.enum(["entrada", "saida", "ajuste"]),
  quantidade: z.coerce.number().positive(),
  motivo: z.string().max(128).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await exigirAdminApi();
  if (!admin.ok) return admin.res;
  const pecaId = Number(params.id);
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "dados_invalidos" }, { status: 400 });
  }
  const { tipo, quantidade, motivo } = parsed.data;
  const autor = admin.sessao.nome;

  // movimentacoes.quantidade ainda é integer — arredonda pra registrar (o saldo real
  // fica em pecas.saldo com precisão decimal). Se você lançou 0.5 LT, aparece 1
  // no histórico mas o saldo desce 0.5.
  const quantidadeInt = Math.max(1, Math.round(quantidade));

  await db.transaction(async (tx) => {
    if (tipo === "entrada") {
      await tx
        .update(pecas)
        .set({ saldo: sql`${pecas.saldo} + ${quantidade}` })
        .where(eq(pecas.id, pecaId));
    } else if (tipo === "saida") {
      await tx
        .update(pecas)
        .set({ saldo: sql`GREATEST(0, ${pecas.saldo} - ${quantidade})` })
        .where(eq(pecas.id, pecaId));
    } else {
      await tx
        .update(pecas)
        .set({ saldo: String(quantidade) })
        .where(eq(pecas.id, pecaId));
    }
    await tx.insert(movimentacoes).values({
      pecaId,
      tipo,
      quantidade: quantidadeInt,
      motivo: motivo ?? null,
      autor,
    });
  });

  const mapa: Record<string, AuditAcao> = {
    entrada: "peca_ajuste_entrada",
    saida: "peca_ajuste_saida",
    ajuste: "peca_ajuste_direto",
  };
  await auditar({
    req,
    sessao: admin.sessao,
    acao: mapa[tipo],
    entidade: "peca",
    entidadeId: pecaId,
    resumo: `Ajuste ${tipo} — ${quantidade} un (motivo: ${motivo ?? "—"}).`,
    diff: { tipo, quantidade, motivo: motivo ?? null },
  });

  return NextResponse.json({ ok: true });
}
