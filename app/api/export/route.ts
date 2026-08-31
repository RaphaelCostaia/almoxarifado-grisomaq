import { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { pedidos, STATUS_PEDIDO_LABELS } from "@/db/schema";
import { toCSV } from "@/lib/csv";
import { formatBR } from "@/lib/date";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const rows = await db.select().from(pedidos).orderBy(desc(pedidos.criadoEm));
  const csv = toCSV(
    rows.map((r) => ({
      ID: r.id,
      Frota: r.frota,
      Descricao: r.descricao,
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
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedidos-grisomaq-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
