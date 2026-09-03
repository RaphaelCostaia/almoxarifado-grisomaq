import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { exigirAdminApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const admin = await exigirAdminApi();
  if (!admin.ok) return admin.res;

  // Soft delete em lote — preserva pedido_eventos e mantém o rastro auditável
  const rem = await db.execute(sql`
    WITH mudados AS (
      UPDATE pedidos
      SET deletado_em = now(),
          deletado_por = ${admin.sessao.nome}
      WHERE status = 'cancelada'
        AND deletado_em IS NULL
      RETURNING id
    )
    SELECT COUNT(*)::int AS n FROM mudados
  `);
  const n = Number((rem as any[])[0]?.n ?? 0);
  return NextResponse.json({ ok: true, apagados: n });
}
