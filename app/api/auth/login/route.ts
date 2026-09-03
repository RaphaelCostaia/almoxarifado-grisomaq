import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assinarSessao, autenticar, setSessionCookie } from "@/lib/auth";
import { auditar } from "@/lib/auditar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  nome: z.string().min(2).max(64),
  senha: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "dados_invalidos" }, { status: 400 });
  }
  const u = await autenticar(parsed.data.nome, parsed.data.senha);
  if (!u) {
    // Login falho — ator=null, mas registra tentativa
    await auditar({
      req,
      acao: "login_falha",
      entidade: "sessao",
      resumo: `Tentativa de login falhou pra "${parsed.data.nome}".`,
      diff: { nomeTentado: parsed.data.nome },
    });
    return NextResponse.json(
      { error: "credenciais_invalidas" },
      { status: 401 }
    );
  }
  const token = await assinarSessao({
    uid: u.id,
    nome: u.nome,
    role: u.role,
  });
  setSessionCookie(token);
  await auditar({
    req,
    sessao: { uid: u.id, nome: u.nome, role: u.role },
    acao: "login_ok",
    entidade: "sessao",
    entidadeId: u.id,
    resumo: `Login efetuado: ${u.nome} (${u.role}).`,
  });
  return NextResponse.json({
    usuario: { id: u.id, nome: u.nome, role: u.role },
  });
}
