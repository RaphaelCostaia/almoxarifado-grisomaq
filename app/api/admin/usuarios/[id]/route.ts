import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { usuarios } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";
import { auditar } from "@/lib/auditar";
import type { AuditAcao } from "@/lib/audit-acoes";

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
  const [antes] = await db.select().from(usuarios).where(eq(usuarios.id, id));
  await db.update(usuarios).set(update).where(eq(usuarios.id, id));

  // Auditoria por campo alterado
  if (parsed.data.ativo !== undefined && antes) {
    const antesAtivo = antes.ativo === 1;
    const depoisAtivo = !!parsed.data.ativo;
    if (antesAtivo !== depoisAtivo) {
      const acao: AuditAcao = depoisAtivo ? "usuario_ativar" : "usuario_desativar";
      await auditar({
        req,
        sessao: auth.sessao,
        acao,
        entidade: "usuario",
        entidadeId: id,
        resumo: `Usuário ${antes.nome} ${depoisAtivo ? "ativado" : "desativado"}.`,
      });
    }
  }
  if (parsed.data.role !== undefined && antes && parsed.data.role !== antes.role) {
    await auditar({
      req,
      sessao: auth.sessao,
      acao: "usuario_mudar_role",
      entidade: "usuario",
      entidadeId: id,
      resumo: `Usuário ${antes.nome}: ${antes.role} → ${parsed.data.role}.`,
      diff: { roleAntes: antes.role, roleDepois: parsed.data.role },
    });
  }

  return NextResponse.json({ ok: true });
}
