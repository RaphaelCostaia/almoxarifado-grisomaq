import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pecas, movimentacoes } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  tipo: z.enum(["entrada", "saida", "ajuste"]),
  quantidade: z.coerce.number().int().positive(),
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
        .set({ saldo: quantidade })
        .where(eq(pecas.id, pecaId));
    }
    await tx.insert(movimentacoes).values({
      pecaId,
      tipo,
      quantidade,
      motivo: motivo ?? null,
      autor,
    });
  });

  return NextResponse.json({ ok: true });
}
