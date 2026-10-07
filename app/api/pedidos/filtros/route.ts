// Lista distinta de `frotas` e `locais` usada pelos dropdowns de filtro do
// Kanban de pedidos. Separado de `/api/pedidos` pra não rodar os 2 full-scans
// (selectDistinct) a cada polling de 4s na listagem.
// Cliente consome com dedupingInterval alto (60s) — muda pouco no dia a dia.
import { NextResponse } from "next/server";
import { isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { pedidos } from "@/db/schema";
import { exigirSessaoApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await exigirSessaoApi();
  if (!auth.ok) return auth.res;

  const [frotasDistinct, locaisDistinct] = await Promise.all([
    db
      .selectDistinct({ frota: pedidos.frota })
      .from(pedidos)
      .where(isNull(pedidos.deletadoEm)),
    db
      .selectDistinct({ local: pedidos.local })
      .from(pedidos)
      .where(isNull(pedidos.deletadoEm)),
  ]);

  return NextResponse.json({
    frotas: frotasDistinct.map((f) => f.frota).filter(Boolean),
    locais: locaisDistinct.map((l) => l.local).filter(Boolean),
  });
}
