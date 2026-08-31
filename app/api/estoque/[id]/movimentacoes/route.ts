import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { movimentacoes } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const pecaId = Number(params.id);
  const rows = await db
    .select()
    .from(movimentacoes)
    .where(eq(movimentacoes.pecaId, pecaId))
    .orderBy(desc(movimentacoes.criadoEm))
    .limit(200);
  return NextResponse.json({ movimentacoes: rows });
}
