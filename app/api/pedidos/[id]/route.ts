import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  pedidos,
  pedidoEventos,
  pecas,
  movimentacoes,
  STATUS_PEDIDO_LABELS,
} from "@/db/schema";
import { exigirAdminApi, exigirSessaoApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  status: z
    .enum([
      "solicitada",
      "providenciando",
      "aguardando_buscar",
      "aguardando_retirada",
      "entregue",
      "cancelada",
    ])
    .optional(),
  prioridade: z.enum(["normal", "urgente"]).optional(),
  observacoes: z.string().optional().nullable(),
  comentario: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id_invalido" }, { status: 400 });
  }
  const pedido = await db
    .select()
    .from(pedidos)
    .where(eq(pedidos.id, id))
    .limit(1);
  if (pedido.length === 0) {
    return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  }
  const eventos = await db
    .select()
    .from(pedidoEventos)
    .where(eq(pedidoEventos.pedidoId, id))
    .orderBy(asc(pedidoEventos.criadoEm));

  let peca = null;
  if (pedido[0].pecaId) {
    const p = await db
      .select()
      .from(pecas)
      .where(eq(pecas.id, pedido[0].pecaId))
      .limit(1);
    peca = p[0] ?? null;
  }

  return NextResponse.json({ pedido: pedido[0], eventos, peca });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id_invalido" }, { status: 400 });
  }
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "dados_invalidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { status, prioridade, observacoes, comentario } = parsed.data;

  // Só admin pode mudar status/prioridade. Funcionário só pode adicionar comentário.
  const alteracaoRestrita =
    status !== undefined ||
    prioridade !== undefined ||
    observacoes !== undefined;
  if (alteracaoRestrita) {
    const admin = await exigirAdminApi();
    if (!admin.ok) return admin.res;
  }
  const auth = await exigirSessaoApi();
  if (!auth.ok) return auth.res;
  const autor = auth.sessao.nome;

  const [atual] = await db
    .select()
    .from(pedidos)
    .where(eq(pedidos.id, id))
    .limit(1);
  if (!atual) {
    return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  }

  const update: any = { atualizadoEm: new Date() };
  const eventos: { texto: string }[] = [];
  if (comentario && comentario.trim().length > 0) {
    eventos.push({ texto: comentario.trim() });
  }

  if (status && status !== atual.status) {
    update.status = status;
    if (status === "entregue") update.entregueEm = new Date();
    if (status !== "entregue") update.entregueEm = null;
    eventos.push({
      texto: `Status alterado para: ${STATUS_PEDIDO_LABELS[status]}.`,
    });

    // Baixa automática de estoque ao entregar
    if (status === "entregue" && atual.pecaId) {
      await db.transaction(async (tx) => {
        await tx
          .update(pecas)
          .set({
            saldo: sql`GREATEST(0, ${pecas.saldo} - ${atual.quantidade})`,
          })
          .where(eq(pecas.id, atual.pecaId as number));
        await tx.insert(movimentacoes).values({
          pecaId: atual.pecaId as number,
          tipo: "saida",
          quantidade: atual.quantidade,
          motivo: `Entrega pedido #${atual.id}`,
          pedidoId: atual.id,
          autor,
        });
      });
    }
  }

  if (prioridade && prioridade !== atual.prioridade) {
    update.prioridade = prioridade;
    eventos.push({
      texto:
        prioridade === "urgente"
          ? "Pedido marcado como URGENTE."
          : "Prioridade voltou a Normal.",
    });
  }

  if (observacoes !== undefined && observacoes !== atual.observacoes) {
    update.observacoes = observacoes;
  }

  await db.update(pedidos).set(update).where(eq(pedidos.id, id));

  for (const e of eventos) {
    await db.insert(pedidoEventos).values({
      pedidoId: id,
      autor,
      texto: e.texto,
    });
  }

  const [novo] = await db
    .select()
    .from(pedidos)
    .where(eq(pedidos.id, id))
    .limit(1);
  return NextResponse.json({ pedido: novo });
}
