import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pecas } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";
import { auditar } from "@/lib/auditar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cache simples em memória do processo pro bloco "resumo" (count/sum em
// pecas). O resumo muda só quando o admin cria/edita/baixa peças — o
// polling do catálogo é a cada 30s, então um TTL de 30s já poupa 95% das
// agregações sobre 14k linhas.
let resumoCache: {
  valor: { total: number; repor: number; criticos: number };
  expiraEm: number;
} | null = null;
const RESUMO_TTL_MS = 30_000;

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
  // `campo=codigo` restringe a busca aos campos de código (usado pelo
  // autocomplete em modo "porCodigo"). Fora disso busca mista nome+códigos.
  const campo = url.searchParams.get("campo")?.trim();
  const limit = Math.min(500, Number(url.searchParams.get("limit") ?? 200));

  const conds: any[] = [isNull(pecas.deletadoEm)];
  if (q) {
    if (campo === "codigo") {
      // Modo "só código": prefixo em codigo/codigoFabricante/codigoParalelo.
      // Prefixo (`q%`) em vez de `%q%` evita que códigos curtos como "701"
      // sejam engolidos por códigos maiores que contêm "701" como substring.
      conds.push(
        or(
          ilike(pecas.codigo, `${q}%`),
          ilike(pecas.codigoFabricante, `${q}%`),
          ilike(pecas.codigoParalelo, `${q}%`)
        )
      );
    } else {
      // Modo mista — inclui `codigoParalelo` (gap antes).
      conds.push(
        or(
          ilike(pecas.nome, `%${q}%`),
          ilike(pecas.codigo, `%${q}%`),
          ilike(pecas.codigoFabricante, `%${q}%`),
          ilike(pecas.codigoParalelo, `%${q}%`)
        )
      );
    }
  }
  if (familia) conds.push(eq(pecas.familia, familia));

  // Ranking de relevância (só aplicado quando há `q`):
  //   1º — match exato de código em qualquer um dos 3 campos
  //   2º — prefixo em `codigo`
  //   3º — prefixo em `nome`
  //   4º — alfabético por nome
  // Garante que a peça cujo código é exatamente o que o usuário digitou
  // vem no topo, mesmo que outras peças matchem como substring.
  const orderBy = q
    ? [
        sql`CASE WHEN ${pecas.codigo} = ${q}
                  OR ${pecas.codigoFabricante} = ${q}
                  OR ${pecas.codigoParalelo} = ${q} THEN 0 ELSE 1 END`,
        sql`CASE WHEN ${pecas.codigo} ILIKE ${q + "%"} THEN 0 ELSE 1 END`,
        sql`CASE WHEN ${pecas.nome} ILIKE ${q + "%"} THEN 0 ELSE 1 END`,
        asc(pecas.nome),
      ]
    : [asc(pecas.nome)];

  const rows = await db
    .select()
    .from(pecas)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(...orderBy)
    .limit(limit);

  const agora = Date.now();
  if (!resumoCache || resumoCache.expiraEm < agora) {
    const totais = await db
      .select({
        total: sql<number>`count(*)::int`,
        repor: sql<number>`sum(case when saldo <= minimo and saldo > 0 then 1 else 0 end)::int`,
        criticos: sql<number>`sum(case when saldo = 0 then 1 else 0 end)::int`,
      })
      .from(pecas)
      .where(isNull(pecas.deletadoEm));
    resumoCache = {
      valor: totais[0] ?? { total: 0, repor: 0, criticos: 0 },
      expiraEm: agora + RESUMO_TTL_MS,
    };
  }

  return NextResponse.json({
    pecas: rows,
    resumo: resumoCache.valor,
  });
}

// Invalida cache quando algo muda — chamado pelos handlers que escrevem.
function invalidarResumo() {
  resumoCache = null;
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
    invalidarResumo();
    await auditar({
      req,
      sessao: admin.sessao,
      acao: "peca_criar",
      entidade: "peca",
      entidadeId: p.id,
      resumo: `Peça cadastrada: ${p.nome}${p.codigo ? ` (${p.codigo})` : ""}.`,
      diff: {
        codigo: p.codigo,
        nome: p.nome,
        unidade: p.unidade,
        saldo: p.saldo,
        familia: p.familia,
      },
    });
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
