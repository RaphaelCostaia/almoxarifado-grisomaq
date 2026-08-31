import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { usuarios } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";
import { hashSenha } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NovoSchema = z.object({
  nome: z.string().min(2).max(64),
  senha: z.string().min(6).max(128),
  role: z.enum(["admin", "funcionario"]).default("funcionario"),
});

export async function GET() {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;
  const rows = await db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      role: usuarios.role,
      ativo: usuarios.ativo,
      criadoEm: usuarios.criadoEm,
    })
    .from(usuarios)
    .orderBy(asc(usuarios.nome));
  return NextResponse.json({ usuarios: rows });
}

export async function POST(req: NextRequest) {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;
  const parsed = NovoSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "dados_invalidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { nome, senha, role } = parsed.data;
  const hash = await hashSenha(senha);
  try {
    const [u] = await db
      .insert(usuarios)
      .values({ nome, senhaHash: hash, role, ativo: 1 })
      .returning({
        id: usuarios.id,
        nome: usuarios.nome,
        role: usuarios.role,
        ativo: usuarios.ativo,
      });
    return NextResponse.json({ usuario: u }, { status: 201 });
  } catch (e: any) {
    if (String(e?.message ?? "").includes("duplicate")) {
      return NextResponse.json({ error: "nome_ja_existe" }, { status: 409 });
    }
    throw e;
  }
}
