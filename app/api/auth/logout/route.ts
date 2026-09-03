import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, sessaoAtual } from "@/lib/auth";
import { auditar } from "@/lib/auditar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sess = await sessaoAtual();
  clearSessionCookie();
  await auditar({
    req,
    sessao: sess ?? null,
    acao: "logout",
    entidade: "sessao",
    entidadeId: sess?.uid ?? null,
    resumo: sess ? `Logout: ${sess.nome}.` : "Logout (sessão já vazia).",
  });
  return NextResponse.json({ ok: true });
}
