import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { usuarios } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  ativo: z.union([z.boolean(), z.number()]).optional(),
  role: z.enum(["admin", "funcionario"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;
  const id = Number(params.id);
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "dados_invalidos" }, { status: 400 });
  }
  const update: any = {};
  if (parsed.data.ativo !== undefined) {
    update.ativo = parsed.data.ativo ? 1 : 0;
  }
  if (parsed.data.role !== undefined) {
    // Não permitir remover o próprio papel de admin
    if (id === auth.sessao.uid && parsed.data.role !== "admin") {
      return NextResponse.json(
        { error: "nao_pode_rebaixar_a_si_mesmo" },
        { status: 400 }
      );
    }
    update.role = parsed.data.role;
  }
  await db.update(usuarios).set(update).where(eq(usuarios.id, id));
  return NextResponse.json({ ok: true });
}
