import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pedidos, pedidoEventos, pecas } from "@/db/schema";
import { exigirSessaoApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NovoPedidoSchema = z.object({
  frota: z.string().min(1).max(64),
  descricao: z.string().min(1),
  quantidade: z.coerce.number().int().min(1),
  unidade: z.string().min(1).max(16).default("un"),
  motivo: z.string().min(1).max(64),
  prioridade: z.enum(["normal", "urgente"]).default("normal"),
  observacoes: z.string().optional().nullable(),
  fotoUrl: z.string().url().optional().nullable(),
  pecaId: z.coerce.number().int().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const q = url.searchParams.get("q")?.trim().toLowerCase();
  const frota = url.searchParams.get("frota");
  const urgente = url.searchParams.get("urgente") === "1";
  const ocultarFinalizados =
    url.searchParams.get("ocultarFinalizados") === "1";

  const conditions = [] as any[];
  if (q) {
    conditions.push(
      or(
        ilike(pedidos.descricao, `%${q}%`),
        ilike(pedidos.frota, `%${q}%`),
        ilike(pedidos.solicitante, `%${q}%`)
      )
    );
  }
  if (frota && frota !== "todas") {
    conditions.push(eq(pedidos.frota, frota));
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
    .from(pedidos);

  return NextResponse.json({
    pedidos: rows,
    frotas: frotasDistinct.map((f) => f.frota).filter(Boolean),
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
      descricao: dados.descricao,
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
