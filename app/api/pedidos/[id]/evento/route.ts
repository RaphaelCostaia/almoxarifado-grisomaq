import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pedidoEventos, pedidos } from "@/db/schema";
import { exigirSessaoApi } from "@/lib/api-auth";
import { criarNotificacao } from "@/lib/notificar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  texto: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await exigirSessaoApi();
  if (!auth.ok) return auth.res;
  const id = Number(params.id);
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "dados_invalidos" }, { status: 400 });
  }
  const [ev] = await db
    .insert(pedidoEventos)
    .values({
      pedidoId: id,
      autor: auth.sessao.nome,
      texto: parsed.data.texto,
    })
    .returning();

  // Se um admin comentou, avisa o solicitante
  const [pedido] = await db
    .select()
    .from(pedidos)
    .where(eq(pedidos.id, id))
    .limit(1);
  if (pedido) {
    await criarNotificacao({
      destinatario: pedido.solicitante,
      autor: auth.sessao.nome,
      pedidoId: pedido.id,
      texto: `Nova observação em seu pedido #${pedido.id}: "${parsed.data.texto.slice(0, 120)}"`,
    });
  }

  return NextResponse.json({ evento: ev }, { status: 201 });
}
