import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { pedidoEventos } from "@/db/schema";
import { exigirSessaoApi } from "@/lib/api-auth";

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
  return NextResponse.json({ evento: ev }, { status: 201 });
}
