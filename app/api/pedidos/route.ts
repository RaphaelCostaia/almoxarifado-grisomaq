import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pedidos, pedidoEventos, pedidoItens, pecas } from "@/db/schema";
import { inArray, count } from "drizzle-orm";
import { exigirSessaoApi } from "@/lib/api-auth";
import { auditar } from "@/lib/auditar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ItemSchema = z.object({
  descricao: z.string().min(1),
  codigoPeca: z.string().max(64).optional().nullable(),
  fabricante: z.string().max(128).optional().nullable(),
  quantidade: z.coerce.number().int().min(1),
  unidade: z.string().min(1).max(16).default("un"),
  pecaId: z.coerce.number().int().optional().nullable(),
});

// POST aceita dois formatos:
//  (novo) itens: [...]
//  (legado) descricao/codigoPeca/fabricante/quantidade/unidade/pecaId inline
// A validação Zod abaixo cobre o shape "comum" (dados do pedido) e trata
// itens separadamente — pedidos legados que mandam só os campos achatados
// são convertidos pra array de 1 item antes de persistir.
const NovoPedidoSchema = z.object({
  frota: z.string().min(1).max(64),
  local: z.string().max(64).optional().nullable(),
  modeloVeiculo: z.string().max(128).optional().nullable(),
  anoVeiculo: z.string().max(16).optional().nullable(),
  motivo: z.string().min(1).max(200),
  prioridade: z.enum(["normal", "urgente"]).default("normal"),
  observacoes: z.string().optional().nullable(),
  fotoUrl: z.string().min(1).max(500).optional().nullable(),
  // Novo formato
  itens: z.array(ItemSchema).min(1).max(20).optional(),
  // Formato legado — ignorado se `itens` vier preenchido
  descricao: z.string().min(1).optional(),
  codigoPeca: z.string().max(64).optional().nullable(),
  fabricante: z.string().max(128).optional().nullable(),
  quantidade: z.coerce.number().int().min(1).optional(),
  unidade: z.string().min(1).max(16).optional(),
  pecaId: z.coerce.number().int().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const q = url.searchParams.get("q")?.trim().toLowerCase();
  const frota = url.searchParams.get("frota");
  const local = url.searchParams.get("local");
  const urgente = url.searchParams.get("urgente") === "1";
  const ocultarFinalizados =
    url.searchParams.get("ocultarFinalizados") === "1";
  const de = url.searchParams.get("de"); // YYYY-MM-DD
  const ate = url.searchParams.get("ate");

  const conditions = [] as any[];
  conditions.push(isNull(pedidos.deletadoEm));
  if (q) {
    conditions.push(
      or(
        ilike(pedidos.descricao, `%${q}%`),
        ilike(pedidos.frota, `%${q}%`),
        ilike(pedidos.solicitante, `%${q}%`),
        ilike(pedidos.local, `%${q}%`)
      )
    );
  }
  if (frota && frota !== "todas") {
    conditions.push(eq(pedidos.frota, frota));
  }
  if (local && local !== "todos") {
    conditions.push(eq(pedidos.local, local));
  }
  if (urgente) {
    conditions.push(eq(pedidos.prioridade, "urgente"));
  }
  if (ocultarFinalizados) {
    conditions.push(
      sql`${pedidos.status} NOT IN ('entregue','cancelada')`
    );
  }
  if (de) conditions.push(gte(pedidos.criadoEm, new Date(`${de}T00:00:00`)));
  if (ate) conditions.push(lte(pedidos.criadoEm, new Date(`${ate}T23:59:59`)));

  const rowsBase = await db
    .select()
    .from(pedidos)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(pedidos.criadoEm));

  // Contagem de itens por pedido — query separada com GROUP BY, muito mais
  // segura que subselect correlacionado interpolado (interpolação de column
  // dentro de `sql`...``.as()` pode escapar errado em algumas versões do
  // drizzle, fazendo todos os pedidos receberem o COUNT de UM único pedido).
  const ids = rowsBase.map((r) => r.id);
  const contagens = ids.length
    ? await db
        .select({
          pedidoId: pedidoItens.pedidoId,
          qtd: count(),
        })
        .from(pedidoItens)
        .where(inArray(pedidoItens.pedidoId, ids))
        .groupBy(pedidoItens.pedidoId)
    : [];
  const qtdPorPedido = new Map<number, number>(
    contagens.map((c) => [c.pedidoId, Number(c.qtd)])
  );

  const rows = rowsBase.map((r) => ({
    ...r,
    qtdItens: qtdPorPedido.get(r.id) ?? 1,
  }));

  const frotasDistinct = await db
    .selectDistinct({ frota: pedidos.frota })
    .from(pedidos)
    .where(isNull(pedidos.deletadoEm));
  const locaisDistinct = await db
    .selectDistinct({ local: pedidos.local })
    .from(pedidos)
    .where(isNull(pedidos.deletadoEm));

  return NextResponse.json({
    pedidos: rows,
    frotas: frotasDistinct.map((f) => f.frota).filter(Boolean),
    locais: locaisDistinct.map((l) => l.local).filter(Boolean),
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

  // Consolida os dois formatos em um array de itens (mínimo 1).
  const itens =
    dados.itens && dados.itens.length > 0
      ? dados.itens
      : [
          {
            descricao: dados.descricao ?? "",
            codigoPeca: dados.codigoPeca ?? null,
            fabricante: dados.fabricante ?? null,
            quantidade: dados.quantidade ?? 1,
            unidade: dados.unidade ?? "un",
            pecaId: dados.pecaId ?? null,
          },
        ];

  if (!itens[0].descricao || itens[0].descricao.trim() === "") {
    return NextResponse.json(
      { error: "dados_invalidos", detalhes: "descricao ausente no primeiro item" },
      { status: 400 }
    );
  }

  // Valida que todos os pecaId existem (lookup único em lote).
  const pecaIds = itens
    .map((i) => i.pecaId)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const pecasEncontradas = pecaIds.length
    ? await db.select().from(pecas).where(inArray(pecas.id, pecaIds))
    : [];
  const pecasPorId = new Map(pecasEncontradas.map((p) => [p.id, p]));
  for (const id of pecaIds) {
    if (!pecasPorId.has(id)) {
      return NextResponse.json(
        { error: "peca_inexistente", pecaId: id },
        { status: 400 }
      );
    }
  }

  // Resumo achatado em `pedidos` = 1º item (retrocompat com código antigo
  // e com relatórios/CSVs que ainda leem os campos planos).
  const primeiro = itens[0];
  const totalQtd = itens.reduce((acc, i) => acc + i.quantidade, 0);

  const pedidoCriado = await db.transaction(async (tx) => {
    const [pedido] = await tx
      .insert(pedidos)
      .values({
        frota: dados.frota,
        local: dados.local ?? null,
        modeloVeiculo: dados.modeloVeiculo?.trim() || null,
        anoVeiculo: dados.anoVeiculo?.trim() || null,
        descricao: primeiro.descricao,
        codigoPeca: primeiro.codigoPeca?.trim() || null,
        fabricante: primeiro.fabricante?.trim() || null,
        quantidade: primeiro.quantidade,
        unidade: primeiro.unidade,
        motivo: dados.motivo,
        solicitante,
        prioridade: dados.prioridade,
        observacoes: dados.observacoes ?? null,
        fotoUrl: dados.fotoUrl ?? null,
        pecaId: primeiro.pecaId ?? null,
      })
      .returning();

    await tx.insert(pedidoItens).values(
      itens.map((it) => ({
        pedidoId: pedido.id,
        pecaId: it.pecaId ?? null,
        descricao: it.descricao,
        codigoPeca: it.codigoPeca?.trim() || null,
        fabricante: it.fabricante?.trim() || null,
        quantidade: it.quantidade,
        unidade: it.unidade,
      }))
    );

    const vinculadas = itens.filter((i) => i.pecaId).length;
    const texto =
      itens.length === 1
        ? primeiro.pecaId
          ? `Pedido registrado. Peça vinculada ao estoque: ${pecasPorId.get(primeiro.pecaId)!.nome}.`
          : "Pedido registrado."
        : `Pedido registrado com ${itens.length} peças (${vinculadas} vinculadas ao estoque).`;
    await tx.insert(pedidoEventos).values({
      pedidoId: pedido.id,
      autor: solicitante,
      texto,
    });

    return pedido;
  });

  await auditar({
    req,
    sessao: auth.sessao,
    acao: "pedido_criar",
    entidade: "pedido",
    entidadeId: pedidoCriado.id,
    resumo:
      itens.length === 1
        ? `Pedido #${pedidoCriado.id} criado (${dados.frota} — ${primeiro.quantidade} ${primeiro.unidade}).`
        : `Pedido #${pedidoCriado.id} criado (${dados.frota} — ${itens.length} peças, total ${totalQtd}).`,
    diff: {
      frota: pedidoCriado.frota,
      motivo: pedidoCriado.motivo,
      prioridade: pedidoCriado.prioridade,
      itens: itens.map((i) => ({
        descricao: i.descricao,
        codigoPeca: i.codigoPeca ?? null,
        fabricante: i.fabricante ?? null,
        quantidade: i.quantidade,
        unidade: i.unidade,
        pecaId: i.pecaId ?? null,
      })),
    },
  });

  return NextResponse.json({ pedido: pedidoCriado }, { status: 201 });
}
