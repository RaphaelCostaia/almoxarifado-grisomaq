import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pedidos, pedidoEventos, pecas } from "@/db/schema";
import { exigirSessaoApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NovoPedidoSchema = z.object({
  frota: z.string().min(1).max(64),
  local: z.string().max(64).optional().nullable(),
  modeloVeiculo: z.string().max(128).optional().nullable(),
  anoVeiculo: z.string().max(16).optional().nullable(),
  descricao: z.string().min(1),
  codigoPeca: z.string().max(64).optional().nullable(),
  fabricante: z.string().max(128).optional().nullable(),
  quantidade: z.coerce.number().int().min(1),
  unidade: z.string().min(1).max(16).default("un"),
  motivo: z.string().min(1).max(200),
  prioridade: z.enum(["normal", "urgente"]).default("normal"),
  observacoes: z.string().optional().nullable(),
  fotoUrl: z.string().min(1).max(500).optional().nullable(),
  pecaId: z.coerce.number().int().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const q = url.searchParams.get("q")?.trim().toLowerCase();
  const frota = url.searchParams.get("frota");
  const local = url.searchParams.get("local");
  const urgente = url.searchParams.get("urgente") === "1";
  const ocultarFinalizados =
    url.searchParams.get("ocultarFinalizados") === "1";

  const conditions = [] as any[];
  conditions.push(isNull(pedidos.deletadoEm));
  if (q) {
    conditions.push(
      or(
        ilike(pedidos.descricao, `%${q}%`),
        ilike(pedidos.frota, `%${q}%`),
        ilike(pedidos.solicitante, `%${q}%`),
        ilike(pedidos.local, `%${q}%`)
      )
    );
  }
  if (frota && frota !== "todas") {
    conditions.push(eq(pedidos.frota, frota));
  }
  if (local && local !== "todos") {
    conditions.push(eq(pedidos.local, local));
  }
  if (urgente) {
    conditions.push(eq(pedidos.prioridade, "urgente"));
  }
  if (ocultarFinalizados) {
    conditions.push(
      sql`${pedidos.status} NOT IN ('entregue','cancelada')`
    );
  }

  const rows = await db
    .select()
    .from(pedidos)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(pedidos.criadoEm));

  const frotasDistinct = await db
    .selectDistinct({ frota: pedidos.frota })
    .from(pedidos)
    .where(isNull(pedidos.deletadoEm));
  const locaisDistinct = await db
    .selectDistinct({ local: pedidos.local })
    .from(pedidos)
    .where(isNull(pedidos.deletadoEm));

  return NextResponse.json({
    pedidos: rows,
    frotas: frotasDistinct.map((f) => f.frota).filter(Boolean),
    locais: locaisDistinct.map((l) => l.local).filter(Boolean),
  });
}

export async function POST(req: NextRequest) {
  const auth = await exigirSessaoApi();
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const parsed = NovoPedidoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "dados_invalidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const dados = parsed.data;
  const solicitante = auth.sessao.nome;

  let pecaNome: string | null = null;
  if (dados.pecaId) {
    const p = await db
      .select()
      .from(pecas)
      .where(eq(pecas.id, dados.pecaId))
      .limit(1);
    if (p.length === 0) {
      return NextResponse.json(
        { error: "peca_inexistente" },
        { status: 400 }
      );
    }
    pecaNome = p[0].nome;
  }

  const [pedido] = await db
    .insert(pedidos)
    .values({
      frota: dados.frota,
      local: dados.local ?? null,
      modeloVeiculo: dados.modeloVeiculo?.trim() || null,
      anoVeiculo: dados.anoVeiculo?.trim() || null,
      descricao: dados.descricao,
      codigoPeca: dados.codigoPeca?.trim() || null,
      fabricante: dados.fabricante?.trim() || null,
      quantidade: dados.quantidade,
      unidade: dados.unidade,
      motivo: dados.motivo,
      solicitante,
      prioridade: dados.prioridade,
      observacoes: dados.observacoes ?? null,
      fotoUrl: dados.fotoUrl ?? null,
      pecaId: dados.pecaId ?? null,
    })
    .returning();

  await db.insert(pedidoEventos).values({
    pedidoId: pedido.id,
    autor: solicitante,
    texto: pecaNome
      ? `Pedido registrado. Peça vinculada ao estoque: ${pecaNome}.`
      : "Pedido registrado.",
  });

  return NextResponse.json({ pedido }, { status: 201 });
}
