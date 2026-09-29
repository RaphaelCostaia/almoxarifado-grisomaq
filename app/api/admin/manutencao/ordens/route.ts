// Rotas de Ordem de Serviço (OS de manutenção).
// GET — lista pra Kanban (agrupada por status por padrão)
// POST — cria OS (chamada ao clicar "Programar troca" na tela de relatório)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { manutencaoOrdens, pecas } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";
import { auditar } from "@/lib/auditar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;

  const url = req.nextUrl;
  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const frota = url.searchParams.get("frota")?.trim();
  const conds: any[] = [isNull(manutencaoOrdens.deletadoEm)];
  if (q) {
    conds.push(
      or(
        ilike(manutencaoOrdens.frotaNumero, `%${q}%`),
        ilike(manutencaoOrdens.frotaModelo, `%${q}%`),
        ilike(manutencaoOrdens.compartimentoTipo, `%${q}%`),
        ilike(manutencaoOrdens.pecaDescricao, `%${q}%`),
        ilike(manutencaoOrdens.pecaCodigo, `%${q}%`)
      )
    );
  }
  if (status && status !== "todos")
    conds.push(eq(manutencaoOrdens.status, status as any));
  if (frota) conds.push(eq(manutencaoOrdens.frotaNumero, frota));

  const rows = await db
    .select()
    .from(manutencaoOrdens)
    .where(and(...conds))
    .orderBy(desc(manutencaoOrdens.criadoEm));
  return NextResponse.json({ ordens: rows });
}

const NovaSchema = z.object({
  frotaNumero: z.string().min(1).max(64),
  frotaModelo: z.string().max(128).nullable().optional(),
  compartimentoCodigo: z.string().max(16).nullable().optional(),
  compartimentoTipo: z.string().min(1).max(64),
  pecaId: z.number().int().nullable().optional(),
  pecaCodigo: z.string().max(64).nullable().optional(),
  pecaDescricao: z.string().max(255).nullable().optional(),
  quantidade: z.coerce.number().positive().default(1),
  unidade: z.string().max(16).default("un"),
  observacoes: z.string().max(2000).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;
  const parsed = NovaSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "dados_invalidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // Se veio pecaCodigo e não veio pecaId, tenta resolver
  let pecaId = d.pecaId ?? null;
  let pecaDescricao = d.pecaDescricao ?? null;
  let unidade = d.unidade;
  if (!pecaId && d.pecaCodigo) {
    const [p] = await db
      .select({ id: pecas.id, nome: pecas.nome, unidade: pecas.unidade })
      .from(pecas)
      .where(and(eq(pecas.codigo, d.pecaCodigo.trim()), isNull(pecas.deletadoEm)))
      .limit(1);
    if (p) {
      pecaId = p.id;
      pecaDescricao ||= p.nome;
      if (unidade === "un") unidade = p.unidade;
    }
  }

  const [nova] = await db
    .insert(manutencaoOrdens)
    .values({
      frotaNumero: d.frotaNumero.trim(),
      frotaModelo: d.frotaModelo ?? null,
      compartimentoCodigo: d.compartimentoCodigo ?? null,
      compartimentoTipo: d.compartimentoTipo,
      pecaId,
      pecaCodigo: d.pecaCodigo?.trim() ?? null,
      pecaDescricao,
      quantidade: String(d.quantidade),
      unidade,
      status: "programada",
      observacoes: d.observacoes ?? null,
      criadoPor: auth.sessao.nome,
    })
    .returning();

  await auditar({
    req,
    sessao: auth.sessao,
    acao: "manutencao_ordem_criar",
    entidade: "manutencao",
    entidadeId: nova.id,
    resumo: `OS #${nova.id} programada: frota ${nova.frotaNumero} — ${nova.compartimentoTipo}`,
    diff: {
      frota: nova.frotaNumero,
      compartimento: nova.compartimentoTipo,
      peca: nova.pecaDescricao,
      quantidade: nova.quantidade,
      unidade: nova.unidade,
    },
  });

  return NextResponse.json({ ordem: nova }, { status: 201 });
}
