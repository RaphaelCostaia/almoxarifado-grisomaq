import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pecas, pedidos } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await exigirAdminApi();
  if (!admin.ok) return admin.res;
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id_invalido" }, { status: 400 });
  }

  // Bloqueia se houver pedidos EM ANDAMENTO vinculados
  const [pedidoAtivo] = await db
    .select({ id: pedidos.id })
    .from(pedidos)
    .where(
      and(
        eq(pedidos.pecaId, id),
        isNull(pedidos.deletadoEm),
        sql`${pedidos.status} NOT IN ('entregue','cancelada')`
      )
    )
    .limit(1);
  if (pedidoAtivo) {
    return NextResponse.json(
      {
        error: "peca_em_uso",
        mensagem:
          "Não dá pra excluir — essa peça está vinculada a pedidos em andamento. Finalize ou cancele antes.",
      },
      { status: 409 }
    );
  }

  await db
    .update(pecas)
    .set({ deletadoEm: new Date(), deletadoPor: admin.sessao.nome })
    .where(eq(pecas.id, id));
  return NextResponse.json({ ok: true });
}
