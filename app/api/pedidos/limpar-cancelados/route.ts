import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pedidos } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const admin = await exigirAdminApi();
  if (!admin.ok) return admin.res;

  const rem = await db.execute(sql`
    WITH deleted AS (
      DELETE FROM pedidos WHERE status = 'cancelada' RETURNING id
    )
    SELECT COUNT(*)::int AS n FROM deleted
  `);
  const n = Number((rem as any[])[0]?.n ?? 0);
  return NextResponse.json({ ok: true, apagados: n });
}
