import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pedidos, compras, movimentacoes } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;

  // Totais globais — todos filtram soft-delete
  const totalPedidos = await db.execute(sql`
    SELECT COUNT(*)::int as c FROM pedidos WHERE deletado_em IS NULL
  `);

  const porStatus = await db.execute(sql`
    SELECT status::text as status, COUNT(*)::int as c
    FROM pedidos
    WHERE deletado_em IS NULL
    GROUP BY status
  `);

  const topPecas = await db.execute(sql`
    SELECT descricao, COUNT(*)::int as c
    FROM pedidos
    WHERE deletado_em IS NULL
      AND criado_em >= now() - interval '30 days'
    GROUP BY descricao
    ORDER BY c DESC
    LIMIT 8
  `);

  const topFrotas = await db.execute(sql`
    SELECT frota, COUNT(*)::int as c
    FROM pedidos
    WHERE deletado_em IS NULL
      AND criado_em >= now() - interval '30 days'
    GROUP BY frota
    ORDER BY c DESC
    LIMIT 8
  `);

  // Tempo médio de atendimento (entrega) em dias, últimos 30 dias
  const tempoMedio = await db.execute(sql`
    SELECT COALESCE(GREATEST(0, AVG(EXTRACT(EPOCH FROM (entregue_em - criado_em)) / 86400.0)), 0)::float as dias
    FROM pedidos
    WHERE deletado_em IS NULL
      AND status = 'entregue'
      AND entregue_em >= now() - interval '30 days'
  `);

  // Compras últimos 30 dias
  const gastoMes = await db.execute(sql`
    SELECT COALESCE(SUM(valor_total), 0)::float as total, COUNT(*)::int as c
    FROM compras
    WHERE deletado_em IS NULL
      AND status = 'recebida'
      AND atualizado_em >= now() - interval '30 days'
  `);

  // Compras por status (todas ativas)
  const comprasPorStatus = await db.execute(sql`
    SELECT status::text as status, COUNT(*)::int as c
    FROM compras
    WHERE deletado_em IS NULL
    GROUP BY status
  `);

  // Compradas aguardando chegar
  const aguardandoChegar = await db.execute(sql`
    SELECT COUNT(*)::int as c,
           COALESCE(SUM(valor_total), 0)::float as total
    FROM compras
    WHERE deletado_em IS NULL
      AND status = 'comprada'
  `);

  const topFornecedores = await db.execute(sql`
    SELECT fornecedor, COALESCE(SUM(valor_total), 0)::float as total, COUNT(*)::int as c
    FROM compras
    WHERE deletado_em IS NULL
      AND status = 'recebida'
      AND fornecedor IS NOT NULL
      AND atualizado_em >= now() - interval '90 days'
    GROUP BY fornecedor
    ORDER BY total DESC NULLS LAST
    LIMIT 6
  `);

  // Série diária de pedidos criados (últimos 14 dias)
  const serieDiaria = await db.execute(sql`
    WITH dias AS (
      SELECT generate_series(
        date_trunc('day', now()) - interval '13 days',
        date_trunc('day', now()),
        '1 day'
      ) AS dia
    )
    SELECT to_char(dias.dia, 'DD/MM') as label,
           COALESCE(COUNT(p.id), 0)::int as c
    FROM dias
    LEFT JOIN pedidos p
      ON date_trunc('day', p.criado_em) = dias.dia
      AND p.deletado_em IS NULL
    GROUP BY dias.dia
    ORDER BY dias.dia
  `);

  return NextResponse.json({
    totalPedidos: Number((totalPedidos as any[])[0]?.c ?? 0),
    porStatus: (porStatus as any[]).map((r) => ({
      status: r.status,
      c: Number(r.c),
    })),
    topPecas: (topPecas as any[]).map((r) => ({
      descricao: r.descricao,
      c: Number(r.c),
    })),
    topFrotas: (topFrotas as any[]).map((r) => ({
      frota: r.frota,
      c: Number(r.c),
    })),
    tempoMedioDias: Number((tempoMedio as any[])[0]?.dias ?? 0),
    gastoMes: {
      total: Number((gastoMes as any[])[0]?.total ?? 0),
      c: Number((gastoMes as any[])[0]?.c ?? 0),
    },
    topFornecedores: (topFornecedores as any[]).map((r) => ({
      fornecedor: r.fornecedor,
      total: Number(r.total),
      c: Number(r.c),
    })),
    serieDiaria: (serieDiaria as any[]).map((r) => ({
      label: r.label,
      c: Number(r.c),
    })),
    comprasPorStatus: (comprasPorStatus as any[]).map((r) => ({
      status: r.status,
      c: Number(r.c),
    })),
    aguardandoChegar: {
      c: Number((aguardandoChegar as any[])[0]?.c ?? 0),
      total: Number((aguardandoChegar as any[])[0]?.total ?? 0),
    },
  });
}
