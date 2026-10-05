import { NextRequest } from "next/server";
import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { pedidos, pedidoItens, STATUS_PEDIDO_LABELS } from "@/db/schema";
import { toCSV } from "@/lib/csv";
import { formatBR } from "@/lib/date";
import { exigirSessaoApi } from "@/lib/api-auth";
import { auditar } from "@/lib/auditar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await exigirSessaoApi();
  if (!auth.ok) return auth.res;

  const url = req.nextUrl;
  const de = url.searchParams.get("de"); // YYYY-MM-DD
  const ate = url.searchParams.get("ate");

  const conds: any[] = [isNull(pedidos.deletadoEm)];
  if (de) conds.push(gte(pedidos.criadoEm, new Date(`${de}T00:00:00`)));
  if (ate) conds.push(lte(pedidos.criadoEm, new Date(`${ate}T23:59:59`)));

  const rows = await db
    .select()
    .from(pedidos)
    .where(and(...conds))
    .orderBy(desc(pedidos.criadoEm));

  // Busca todos os itens dos pedidos selecionados numa consulta só.
  const idsPedido = rows.map((r) => r.id);
  const itens = idsPedido.length
    ? await db
        .select()
        .from(pedidoItens)
        .where(inArray(pedidoItens.pedidoId, idsPedido))
        .orderBy(asc(pedidoItens.id))
    : [];
  const itensPorPedido = new Map<number, typeof itens>();
  for (const it of itens) {
    const arr = itensPorPedido.get(it.pedidoId) ?? [];
    arr.push(it);
    itensPorPedido.set(it.pedidoId, arr);
  }

  // Emite 1 linha CSV por item do pedido. Pedidos sem itens (edge case) caem
  // nos campos achatados.
  const linhas: Record<string, any>[] = [];
  for (const r of rows) {
    const its = itensPorPedido.get(r.id) ?? [];
    const base = {
      ID: r.id,
      Frota: r.frota,
      Local: r.local ?? "",
      Modelo: r.modeloVeiculo ?? "",
      Ano: r.anoVeiculo ?? "",
      Motivo: r.motivo,
      Solicitante: r.solicitante,
      Prioridade: r.prioridade,
      Status: STATUS_PEDIDO_LABELS[r.status],
      CriadoEm: formatBR(r.criadoEm),
      AtualizadoEm: formatBR(r.atualizadoEm),
      EntregueEm: r.entregueEm ? formatBR(r.entregueEm) : "",
      Observacoes: r.observacoes ?? "",
    };
    if (its.length === 0) {
      linhas.push({
        ...base,
        Item: 1,
        Descricao: r.descricao,
        CodigoPeca: r.codigoPeca ?? "",
        Fabricante: r.fabricante ?? "",
        Quantidade: r.quantidade,
        Unidade: r.unidade,
      });
    } else {
      its.forEach((it, idx) => {
        linhas.push({
          ...base,
          Item: idx + 1,
          Descricao: it.descricao,
          CodigoPeca: it.codigoPeca ?? "",
          Fabricante: it.fabricante ?? "",
          Quantidade: it.quantidade,
          Unidade: it.unidade,
        });
      });
    }
  }
  const csv = toCSV(linhas);
  await auditar({
    req,
    sessao: auth.sessao,
    acao: "export_csv",
    entidade: "export",
    resumo: `Export CSV de pedidos: ${rows.length} pedidos / ${linhas.length} linhas${
      de || ate ? ` (${de ?? "…"} → ${ate ?? "hoje"})` : ""
    }.`,
    diff: { pedidos: rows.length, linhas: linhas.length, de, ate },
  });

  const sufixo = de || ate ? `-${de ?? "inicio"}-${ate ?? "hoje"}` : "";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedidos-grisomaq-${new Date()
        .toISOString()
        .slice(0, 10)}${sufixo}.csv"`,
    },
  });
}
