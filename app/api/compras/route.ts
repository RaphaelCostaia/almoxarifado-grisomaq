import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { compras, compraEventos, pecas, pedidoEventos, pedidos } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";
import { sessaoAtual } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NovaCompraSchema = z.object({
  pedidoId: z.coerce.number().int().optional().nullable(),
  pecaId: z.coerce.number().int().optional().nullable(),
  descricao: z.string().min(1),
  quantidade: z.coerce.number().int().min(1),
  unidade: z.string().min(1).max(16).default("un"),
  fornecedor: z.string().max(128).optional().nullable(),
  valorUnit: z.coerce.number().optional().nullable(),
  condicaoPagamento: z.string().max(128).optional().nullable(),
  prazo: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status");
  const conditions: any[] = [];
  if (q)
    conditions.push(
      or(
        ilike(compras.descricao, `%${q}%`),
        ilike(compras.fornecedor, `%${q}%`)
      )
    );
  if (status && status !== "todos") conditions.push(eq(compras.status, status as any));

  const rows = await db
    .select()
    .from(compras)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      sql`case when ${compras.status} in ('rascunho','aprovada','comprada') then 0 else 1 end`,
      desc(compras.criadoEm)
    );

  // Funcionário não enxerga valores financeiros
  const sess = await sessaoAtual();
  const seguro =
    sess?.role === "admin"
      ? rows
      : rows.map((r) => ({
          ...r,
          valorUnit: null,
          valorTotal: null,
          condicaoPagamento: null,
        }));
  return NextResponse.json({ compras: seguro });
}

export async function POST(req: NextRequest) {
  const admin = await exigirAdminApi();
  if (!admin.ok) return admin.res;
  const body = await req.json();
  const parsed = NovaCompraSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "dados_invalidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const d = { ...parsed.data, autor: admin.sessao.nome };
  const valorTotal =
    d.valorUnit != null ? Number(d.valorUnit) * d.quantidade : null;

  const [compra] = await db
    .insert(compras)
    .values({
      pedidoId: d.pedidoId ?? null,
      pecaId: d.pecaId ?? null,
      descricao: d.descricao,
      quantidade: d.quantidade,
      unidade: d.unidade,
      fornecedor: d.fornecedor ?? null,
      valorUnit: d.valorUnit != null ? d.valorUnit.toFixed(2) : null,
      valorTotal: valorTotal != null ? valorTotal.toFixed(2) : null,
      condicaoPagamento: d.condicaoPagamento?.trim() || null,
      prazo: d.prazo ? new Date(d.prazo) : null,
      observacoes: d.observacoes ?? null,
      autor: d.autor,
      status: "rascunho",
    })
    .returning();

  await db.insert(compraEventos).values({
    compraId: compra.id,
    autor: d.autor,
    texto: d.pedidoId
      ? `Solicitação de compra criada a partir do pedido #${d.pedidoId}.`
      : "Solicitação de compra criada.",
  });

  // Marca o pedido de origem como "providenciando" se ainda estiver em "solicitada"
  if (d.pedidoId) {
    const [ped] = await db
      .select()
      .from(pedidos)
      .where(eq(pedidos.id, d.pedidoId))
      .limit(1);
    if (ped && ped.status === "solicitada") {
      await db
        .update(pedidos)
        .set({ status: "providenciando", atualizadoEm: new Date() })
        .where(eq(pedidos.id, d.pedidoId));
      await db.insert(pedidoEventos).values({
        pedidoId: d.pedidoId,
        autor: d.autor,
        texto: `Solicitação de compra #${compra.id} aberta — pedido em providência.`,
      });
    }
  }

  return NextResponse.json({ compra }, { status: 201 });
}
