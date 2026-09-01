import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notificacoes } from "@/db/schema";
import { exigirSessaoApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  id: z.coerce.number().int().optional(),
  todas: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await exigirSessaoApi();
  if (!auth.ok) return auth.res;
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "dados_invalidos" }, { status: 400 });
  }
  const { id, todas } = parsed.data;

  if (todas) {
    await db
      .update(notificacoes)
      .set({ lida: 1 })
      .where(
        and(
          eq(notificacoes.destinatario, auth.sessao.nome),
          eq(notificacoes.lida, 0)
        )
      );
    return NextResponse.json({ ok: true });
  }
  if (id) {
    await db
      .update(notificacoes)
      .set({ lida: 1 })
      .where(
        and(
          eq(notificacoes.id, id),
          eq(notificacoes.destinatario, auth.sessao.nome)
        )
      );
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "faltou_id_ou_todas" }, { status: 400 });
}
