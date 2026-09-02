import { NextRequest } from "next/server";
import { and, desc, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { pedidos, STATUS_PEDIDO_LABELS } from "@/db/schema";
import { toCSV } from "@/lib/csv";
import { formatBR } from "@/lib/date";
import { exigirSessaoApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await exigirSessaoApi();
  if (!auth.ok) return auth.res;

  const url = req.nextUrl;
  const de = url.searchParams.get("de"); // YYYY-MM-DD
  const ate = url.searchParams.get("ate");

  const conds: any[] = [];
  if (de) conds.push(gte(pedidos.criadoEm, new Date(`${de}T00:00:00`)));
  if (ate) conds.push(lte(pedidos.criadoEm, new Date(`${ate}T23:59:59`)));

  const rows = await db
    .select()
    .from(pedidos)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(pedidos.criadoEm));
  const csv = toCSV(
    rows.map((r) => ({
      ID: r.id,
      Frota: r.frota,
      Local: r.local ?? "",
      Modelo: r.modeloVeiculo ?? "",
      Ano: r.anoVeiculo ?? "",
      Descricao: r.descricao,
      CodigoPeca: r.codigoPeca ?? "",
      Fabricante: r.fabricante ?? "",
      Quantidade: r.quantidade,
      Unidade: r.unidade,
      Motivo: r.motivo,
      Solicitante: r.solicitante,
      Prioridade: r.prioridade,
      Status: STATUS_PEDIDO_LABELS[r.status],
      CriadoEm: formatBR(r.criadoEm),
      AtualizadoEm: formatBR(r.atualizadoEm),
      EntregueEm: r.entregueEm ? formatBR(r.entregueEm) : "",
      Observacoes: r.observacoes ?? "",
    }))
  );
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
