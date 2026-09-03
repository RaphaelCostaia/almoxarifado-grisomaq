import { NextResponse } from "next/server";
import { and, asc, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pecas } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .selectDistinct({ familia: pecas.familia })
    .from(pecas)
    .where(
      and(
        isNull(pecas.deletadoEm),
        sql`${pecas.familia} is not null and ${pecas.familia} <> ''`
      )
    )
    .orderBy(asc(pecas.familia));
  return NextResponse.json({
    familias: rows.map((r) => r.familia).filter(Boolean) as string[],
  });
}
