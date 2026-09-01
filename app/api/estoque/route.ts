import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pecas } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NovaPecaSchema = z.object({
  codigo: z.string().max(64).optional().nullable(),
  nome: z.string().min(1).max(255),
  unidade: z.string().min(1).max(16).default("un"),
  saldo: z.coerce.number().int().min(0).default(0),
  minimo: z.coerce.number().int().min(0).default(0),
  maximo: z.coerce.number().int().min(0).default(0),
  localizacao: z.string().max(128).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const q = url.searchParams.get("q")?.trim();
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 200));

  const rows = await db
    .select()
    .from(pecas)
    .where(
      q
        ? or(ilike(pecas.nome, `%${q}%`), ilike(pecas.codigo, `%${q}%`))
        : undefined
    )
    .orderBy(asc(pecas.nome))
    .limit(limit);

  const totais = await db
    .select({
      total: sql<number>`count(*)::int`,
      repor: sql<number>`sum(case when saldo <= minimo and saldo > 0 then 1 else 0 end)::int`,
      criticos: sql<number>`sum(case when saldo = 0 then 1 else 0 end)::int`,
    })
    .from(pecas);

  return NextResponse.json({
    pecas: rows,
    resumo: totais[0] ?? { total: 0, repor: 0, criticos: 0 },
  });
}

export async function POST(req: NextRequest) {
  const admin = await exigirAdminApi();
  if (!admin.ok) return admin.res;
  const body = await req.json();
  const parsed = NovaPecaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "dados_invalidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const dados = {
    ...parsed.data,
    codigo: parsed.data.codigo?.trim() || null,
    nome: parsed.data.nome.trim(),
  };

  // Pré-checagem explícita — retorna 409 com campo específico
  const duplicados: string[] = [];
  if (dados.codigo) {
    const [existe] = await db
      .select({ id: pecas.id })
      .from(pecas)
      .where(eq(pecas.codigo, dados.codigo))
      .limit(1);
    if (existe) duplicados.push("codigo");
  }
  const [existeNome] = await db
    .select({ id: pecas.id })
    .from(pecas)
    .where(eq(pecas.nome, dados.nome))
    .limit(1);
  if (existeNome) duplicados.push("nome");

  if (duplicados.length > 0) {
    return NextResponse.json(
      {
        error: "peca_duplicada",
        campos: duplicados,
        mensagem:
          duplicados.includes("codigo") && duplicados.includes("nome")
            ? "Já existe uma peça com esse código E com esse nome."
            : duplicados.includes("codigo")
            ? "Já existe uma peça com esse código."
            : "Já existe uma peça com esse nome.",
      },
      { status: 409 }
    );
  }

  try {
    const [p] = await db.insert(pecas).values(dados).returning();
    return NextResponse.json({ peca: p }, { status: 201 });
  } catch (e: any) {
    // Fallback: se der corrida entre checagem e insert
    const codigoErro = e?.code ?? e?.cause?.code;
    if (codigoErro === "23505") {
      const constraint =
        e?.constraint_name ?? e?.constraint ?? e?.cause?.constraint_name ?? "";
      const campo = String(constraint).includes("codigo") ? "codigo" : "nome";
      return NextResponse.json(
        {
          error: "peca_duplicada",
          campos: [campo],
          mensagem:
            campo === "codigo"
              ? "Já existe uma peça com esse código."
              : "Já existe uma peça com esse nome.",
        },
        { status: 409 }
      );
    }
    throw e;
  }
}
