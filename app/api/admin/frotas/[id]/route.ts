import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { frotas, pedidos } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  numero: z.string().min(1).max(32).optional(),
  categoria: z.enum(["equipamento", "implemento"]).optional(),
  modelo: z.string().max(128).optional().nullable(),
  marca: z.string().max(64).optional().nullable(),
  descricao: z.string().max(128).optional().nullable(),
  ano: z.string().max(8).optional().nullable(),
  placa: z.string().max(16).optional().nullable(),
  chassi: z.string().max(32).optional().nullable(),
  localizacao: z.string().max(64).optional().nullable(),
  proprietario: z.string().max(128).optional().nullable(),
  ativo: z.union([z.boolean(), z.number()]).optional(),
  observacoes: z.string().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id_invalido" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "dados_invalidos" }, { status: 400 });
  }
  const d = parsed.data;

  // Se mudou o numero, garante unicidade
  if (d.numero) {
    const numero = d.numero.trim();
    const [conflict] = await db
      .select({ id: frotas.id })
      .from(frotas)
      .where(and(eq(frotas.numero, numero), sql`${frotas.id} <> ${id}`))
      .limit(1);
    if (conflict) {
      return NextResponse.json(
        { error: "numero_duplicado", mensagem: `Já existe frota com número ${numero}.` },
        { status: 409 }
      );
    }
    d.numero = numero;
  }

  const update: any = { ...d };
  if (typeof d.ativo === "boolean") update.ativo = d.ativo ? 1 : 0;

  await db.update(frotas).set(update).where(eq(frotas.id, id));
  const [novo] = await db.select().from(frotas).where(eq(frotas.id, id));
  return NextResponse.json({ frota: novo });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;
  const id = Number(params.id);
  const [f] = await db
    .select()
    .from(frotas)
    .where(and(eq(frotas.id, id), isNull(frotas.deletadoEm)));
  if (!f) {
    return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  }
  // Bloqueia se houver pedidos vinculados ao número dessa frota
  const [temPedido] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(pedidos)
    .where(and(eq(pedidos.frota, f.numero), isNull(pedidos.deletadoEm)));
  if ((temPedido?.c ?? 0) > 0) {
    return NextResponse.json(
      {
        error: "frota_em_uso",
        mensagem: `Não dá pra excluir — existem ${temPedido.c} pedido(s) usando essa frota. Use 'Desativar' se ela saiu de operação (mantém o histórico).`,
      },
      { status: 409 }
    );
  }
  await db
    .update(frotas)
    .set({ deletadoEm: new Date(), deletadoPor: auth.sessao.nome })
    .where(eq(frotas.id, id));
  return NextResponse.json({ ok: true });
}
