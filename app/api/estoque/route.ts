import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pecas } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const decimal = z.coerce.number().nonnegative().default(0);

const NovaPecaSchema = z.object({
  codigo: z.string().max(64).optional().nullable(),
  nome: z.string().min(1).max(255),
  unidade: z.string().min(1).max(16).default("un"),
  saldo: decimal,
  minimo: decimal,
  maximo: decimal,
  localizacao: z.string().max(128).optional().nullable(),
  familia: z.string().max(64).optional().nullable(),
  codigoFabricante: z.string().max(64).optional().nullable(),
  codigoParalelo: z.string().max(64).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const q = url.searchParams.get("q")?.trim();
  const familia = url.searchParams.get("familia")?.trim();
  const limit = Math.min(500, Number(url.searchParams.get("limit") ?? 200));

  const conds: any[] = [isNull(pecas.deletadoEm)];
  if (q) {
    conds.push(
      or(
        ilike(pecas.nome, `%${q}%`),
        ilike(pecas.codigo, `%${q}%`),
        ilike(pecas.codigoFabricante, `%${q}%`)
      )
    );
  }
  if (familia) conds.push(eq(pecas.familia, familia));

  const rows = await db
    .select()
    .from(pecas)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(pecas.nome))
    .limit(limit);

  const totais = await db
    .select({
      total: sql<number>`count(*)::int`,
      repor: sql<number>`sum(case when saldo <= minimo and saldo > 0 then 1 else 0 end)::int`,
      criticos: sql<number>`sum(case when saldo = 0 then 1 else 0 end)::int`,
    })
    .from(pecas)
    .where(isNull(pecas.deletadoEm));

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
  const dados: any = {
    ...parsed.data,
    codigo: parsed.data.codigo?.trim() || null,
    nome: parsed.data.nome.trim(),
    familia: parsed.data.familia?.trim() || null,
    codigoFabricante: parsed.data.codigoFabricante?.trim() || null,
    codigoParalelo: parsed.data.codigoParalelo?.trim() || null,
    // drizzle numeric aceita string ou number — enviamos como string
    saldo: String(parsed.data.saldo),
    minimo: String(parsed.data.minimo),
    maximo: String(parsed.data.maximo),
  };

  if (dados.codigo) {
    const [existe] = await db
      .select({ id: pecas.id })
      .from(pecas)
      .where(eq(pecas.codigo, dados.codigo))
      .limit(1);
    if (existe) {
      return NextResponse.json(
        {
          error: "peca_duplicada",
          campos: ["codigo"],
          mensagem: "Já existe uma peça com esse código.",
        },
        { status: 409 }
      );
    }
  }

  try {
    const [p] = await db.insert(pecas).values(dados).returning();
    return NextResponse.json({ peca: p }, { status: 201 });
  } catch (e: any) {
    const codigoErro = e?.code ?? e?.cause?.code;
    if (codigoErro === "23505") {
      return NextResponse.json(
        {
          error: "peca_duplicada",
          campos: ["codigo"],
          mensagem: "Já existe uma peça com esse código.",
        },
        { status: 409 }
      );
    }
    throw e;
  }
}
