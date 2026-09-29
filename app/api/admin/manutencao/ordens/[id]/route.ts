// PATCH — mudar status (programada → em_execucao → concluida | cancelada)
// DELETE — soft delete
//
// Quando muda pra "concluida":
//   - Exige hodometroConcluido
//   - Se ordem tem pecaId + quantidade > 0: desconta do estoque numa
//     transação (mesmo padrão do pedido entregue).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { manutencaoOrdens, movimentacoes, pecas } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";
import { auditar } from "@/lib/auditar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  status: z
    .enum(["programada", "em_execucao", "concluida", "cancelada"])
    .optional(),
  hodometroConcluido: z.string().max(32).nullable().optional(),
  observacoes: z.string().max(2000).nullable().optional(),
  pecaId: z.number().int().nullable().optional(),
  pecaCodigo: z.string().max(64).nullable().optional(),
  pecaDescricao: z.string().max(255).nullable().optional(),
  quantidade: z.coerce.number().positive().optional(),
  unidade: z.string().max(16).optional(),
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

  const [atual] = await db
    .select()
    .from(manutencaoOrdens)
    .where(and(eq(manutencaoOrdens.id, id), isNull(manutencaoOrdens.deletadoEm)));
  if (!atual) {
    return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  }

  const nome = auth.sessao.nome;
  const agora = new Date();
  const update: any = { atualizadoEm: agora };

  // Campos livres podem ser atualizados a qualquer momento
  if (d.observacoes !== undefined) update.observacoes = d.observacoes;
  if (d.pecaId !== undefined) update.pecaId = d.pecaId;
  if (d.pecaCodigo !== undefined) update.pecaCodigo = d.pecaCodigo;
  if (d.pecaDescricao !== undefined) update.pecaDescricao = d.pecaDescricao;
  if (d.quantidade !== undefined) update.quantidade = String(d.quantidade);
  if (d.unidade !== undefined) update.unidade = d.unidade;

  let acaoAudit: string = "manutencao_ordem_editar";
  let resumo = `OS #${id} editada`;

  if (d.status && d.status !== atual.status) {
    update.status = d.status;

    if (d.status === "em_execucao") {
      update.iniciadoEm = agora;
      update.iniciadoPor = nome;
      acaoAudit = "manutencao_ordem_iniciar";
      resumo = `OS #${id} em execução (frota ${atual.frotaNumero} — ${atual.compartimentoTipo})`;
    } else if (d.status === "concluida") {
      if (!d.hodometroConcluido || !d.hodometroConcluido.trim()) {
        return NextResponse.json(
          {
            error: "hodometro_obrigatorio",
            mensagem: "Informe o hodômetro atual pra concluir a OS.",
          },
          { status: 400 }
        );
      }
      update.hodometroConcluido = d.hodometroConcluido.trim();
      update.concluidoEm = agora;
      update.concluidoPor = nome;
      acaoAudit = "manutencao_ordem_concluir";
      resumo = `OS #${id} concluída (frota ${atual.frotaNumero} — ${atual.compartimentoTipo})`;

      // Baixa automática de estoque
      const pecaIdFinal = d.pecaId !== undefined ? d.pecaId : atual.pecaId;
      const qtd = d.quantidade !== undefined
        ? Number(d.quantidade)
        : Number(atual.quantidade);
      if (pecaIdFinal && qtd > 0) {
        await db.transaction(async (tx) => {
          await tx
            .update(pecas)
            .set({ saldo: sql`GREATEST(0, ${pecas.saldo} - ${qtd})` })
            .where(eq(pecas.id, pecaIdFinal));
          await tx.insert(movimentacoes).values({
            pecaId: pecaIdFinal,
            tipo: "saida",
            quantidade: Math.max(1, Math.round(qtd)),
            motivo: `Manutenção OS #${id} — ${atual.compartimentoTipo}`,
            autor: nome,
          });
        });
      }
    } else if (d.status === "cancelada") {
      acaoAudit = "manutencao_ordem_cancelar";
      resumo = `OS #${id} cancelada`;
    } else if (d.status === "programada") {
      // Volta pra programada — limpa iniciado
      update.iniciadoEm = null;
      update.iniciadoPor = null;
      acaoAudit = "manutencao_ordem_reabrir";
      resumo = `OS #${id} voltou pra programada`;
    }
  }

  await db.update(manutencaoOrdens).set(update).where(eq(manutencaoOrdens.id, id));
  const [novo] = await db
    .select()
    .from(manutencaoOrdens)
    .where(eq(manutencaoOrdens.id, id));

  await auditar({
    req,
    sessao: auth.sessao,
    acao: acaoAudit as any,
    entidade: "manutencao",
    entidadeId: id,
    resumo,
    diff: { antes: atual, depois: novo },
  });

  return NextResponse.json({ ordem: novo });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;
  const id = Number(params.id);
  const [atual] = await db
    .select()
    .from(manutencaoOrdens)
    .where(and(eq(manutencaoOrdens.id, id), isNull(manutencaoOrdens.deletadoEm)));
  if (!atual) {
    return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  }
  await db
    .update(manutencaoOrdens)
    .set({ deletadoEm: new Date(), deletadoPor: auth.sessao.nome })
    .where(eq(manutencaoOrdens.id, id));
  await auditar({
    req,
    sessao: auth.sessao,
    acao: "manutencao_ordem_soft_delete",
    entidade: "manutencao",
    entidadeId: id,
    resumo: `OS #${id} excluída`,
    diff: { antes: atual },
  });
  return NextResponse.json({ ok: true });
}
