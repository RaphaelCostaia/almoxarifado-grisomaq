import { NextResponse } from "next/server";
import { exigirAdminApi } from "@/lib/api-auth";
import { verificarCadeia } from "@/lib/auditar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;
  const resultado = await verificarCadeia();
  return NextResponse.json(resultado);
}
