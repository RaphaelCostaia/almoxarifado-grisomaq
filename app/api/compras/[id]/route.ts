import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { compraEventos as _compraEventos } from "@/db/schema";
import {
  compras,
  compraEventos,
  movimentacoes,
  pecas,
  pedidoEventos,
  pedidos,
  STATUS_COMPRA_LABELS,
} from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";
import { criarNotificacao } from "@/lib/notificar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  status: z
    .enum(["rascunho", "aprovada", "comprada", "recebida", "cancelada"])
    .optional(),
  fornecedor: z.string().max(128).optional().nullable(),
  valorUnit: z.coerce.number().optional().nullable(),
  prazo: z.string().optional().nullable(),
  nfNumero: z.string().max(64).optional().nullable(),
  nfUrl: z.string().min(1).max(500).optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const [c] = await db.select().from(compras).where(eq(compras.id, id));
  if (!c) return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  const eventos = await db
    .select()
    .from(compraEventos)
    .where(eq(compraEventos.compraId, id))
    .orderBy(asc(compraEventos.criadoEm));
  let peca = null;
  if (c.pecaId) {
    const [p] = await db.select().from(pecas).where(eq(pecas.id, c.pecaId));
    peca = p ?? null;
  }
  let pedidoVinculado = null;
  if (c.pedidoId) {
    const [p] = await db.select().from(pedidos).where(eq(pedidos.id, c.pedidoId));
    pedidoVinculado = p ?? null;
  }
  return NextResponse.json({ compra: c, eventos, peca, pedidoVinculado });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await exigirAdminApi();
  if (!admin.ok) return admin.res;
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id_invalido" }, { status: 400 });
  }
  const [c] = await db.select().from(compras).where(eq(compras.id, id));
  if (!c) {
    return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  }
  const forcar = req.nextUrl.searchParams.get("force") === "true";
  if (c.status !== "rascunho" && !forcar) {
    return NextResponse.json(
      {
        error: "nao_pode_excluir",
        mensagem:
          "Só é possível excluir uma solicitação em rascunho. Para outros status, use 'Cancelar' pra manter o histórico.",
      },
      { status: 409 }
    );
  }
  await db.delete(compras).where(eq(compras.id, id));
  return NextResponse.json({ ok: true, forcado: forcar });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await exigirAdminApi();
  if (!admin.ok) return admin.res;
  const id = Number(params.id);
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "dados_invalidos" }, { status: 400 });
  }
  const dados = { ...parsed.data, autor: admin.sessao.nome };

  const [atual] = await db.select().from(compras).where(eq(compras.id, id));
  if (!atual) return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const update: any = { atualizadoEm: new Date() };
  const eventos: string[] = [];

  if (dados.fornecedor !== undefined && dados.fornecedor !== atual.fornecedor) {
    update.fornecedor = dados.fornecedor;
  }
  if (dados.valorUnit !== undefined) {
    update.valorUnit = dados.valorUnit != null ? dados.valorUnit.toFixed(2) : null;
    update.valorTotal =
      dados.valorUnit != null
        ? (Number(dados.valorUnit) * atual.quantidade).toFixed(2)
        : null;
  }
  if (dados.prazo !== undefined) {
    update.prazo = dados.prazo ? new Date(dados.prazo) : null;
  }
  if (dados.observacoes !== undefined) {
    update.observacoes = dados.observacoes;
  }
  if (dados.nfNumero !== undefined) update.nfNumero = dados.nfNumero;
  if (dados.nfUrl !== undefined) update.nfUrl = dados.nfUrl;

  if (dados.status && dados.status !== atual.status) {
    update.status = dados.status;
    eventos.push(
      `Status alterado para ${STATUS_COMPRA_LABELS[dados.status]}.`
    );

    // Ao receber, dá entrada no estoque + empurra o pedido vinculado
    if (dados.status === "recebida") {
      const pecaId = atual.pecaId;
      const qtd = atual.quantidade;
      await db.transaction(async (tx) => {
        if (pecaId) {
          await tx
            .update(pecas)
            .set({ saldo: sql`${pecas.saldo} + ${qtd}` })
            .where(eq(pecas.id, pecaId));
          await tx.insert(movimentacoes).values({
            pecaId,
            tipo: "entrada",
            quantidade: qtd,
            motivo: `Recebimento compra #${atual.id}${
              dados.nfNumero ? ` NF ${dados.nfNumero}` : ""
            }`,
            compraId: atual.id,
            autor: dados.autor,
          });
        }
        if (atual.pedidoId) {
          const [ped] = await tx
            .select()
            .from(pedidos)
            .where(eq(pedidos.id, atual.pedidoId));
          if (ped && !["entregue", "cancelada"].includes(ped.status)) {
            await tx
              .update(pedidos)
              .set({
                status: "aguardando_retirada",
                atualizadoEm: new Date(),
              })
              .where(eq(pedidos.id, ped.id));
            await tx.insert(pedidoEventos).values({
              pedidoId: ped.id,
              autor: dados.autor,
              texto: `Peça chegou da compra #${atual.id} — aguardando retirada.`,
            });
          }
        }
      });

      // Notifica solicitante (fora da transação, silencioso)
      if (atual.pedidoId) {
        const [ped] = await db
          .select()
          .from(pedidos)
          .where(eq(pedidos.id, atual.pedidoId));
        if (ped) {
          await criarNotificacao({
            destinatario: ped.solicitante,
            autor: dados.autor,
            pedidoId: ped.id,
            texto: `Sua peça chegou! Pedido #${ped.id} (${ped.descricao}) está aguardando retirada.`,
          });
        }
      }
    }
  }

  await db.update(compras).set(update).where(eq(compras.id, id));

  for (const t of eventos) {
    await db.insert(compraEventos).values({
      compraId: id,
      autor: dados.autor,
      texto: t,
    });
  }

  const [novo] = await db.select().from(compras).where(eq(compras.id, id));
  return NextResponse.json({ compra: novo });
}
