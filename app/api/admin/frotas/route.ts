import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { frotas } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NovaSchema = z.object({
  numero: z.string().min(1).max(32),
  categoria: z.enum(["equipamento", "implemento"]).default("equipamento"),
  modelo: z.string().max(128).optional().nullable(),
  marca: z.string().max(64).optional().nullable(),
  descricao: z.string().max(128).optional().nullable(),
  ano: z.string().max(8).optional().nullable(),
  placa: z.string().max(16).optional().nullable(),
  chassi: z.string().max(32).optional().nullable(),
  localizacao: z.string().max(64).optional().nullable(),
  proprietario: z.string().max(128).optional().nullable(),
  ativo: z.union([z.boolean(), z.number()]).default(1),
  observacoes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;

  const url = req.nextUrl;
  const q = url.searchParams.get("q")?.trim();
  const categoria = url.searchParams.get("categoria");
  const status = url.searchParams.get("status"); // 'ativos' | 'inativos' | 'todos'

  const conds: any[] = [];
  if (q) {
    conds.push(
      or(
        ilike(frotas.numero, `%${q}%`),
        ilike(frotas.modelo, `%${q}%`),
        ilike(frotas.marca, `%${q}%`),
        ilike(frotas.descricao, `%${q}%`),
        ilike(frotas.placa, `%${q}%`)
      )
    );
  }
  if (categoria === "equipamento" || categoria === "implemento") {
    conds.push(eq(frotas.categoria, categoria));
  }
  if (status === "ativos") conds.push(eq(frotas.ativo, 1));
  if (status === "inativos") conds.push(eq(frotas.ativo, 0));

  const rows = await db
    .select()
    .from(frotas)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(frotas.categoria, asc(frotas.numero));

  const [resumo] = await db
    .select({
      total: sql<number>`count(*)::int`,
      equipamentos: sql<number>`sum(case when categoria='equipamento' then 1 else 0 end)::int`,
      implementos: sql<number>`sum(case when categoria='implemento' then 1 else 0 end)::int`,
      ativos: sql<number>`sum(case when ativo=1 then 1 else 0 end)::int`,
      inativos: sql<number>`sum(case when ativo=0 then 1 else 0 end)::int`,
    })
    .from(frotas);

  return NextResponse.json({ frotas: rows, resumo });
}

export async function POST(req: NextRequest) {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;
  const parsed = NovaSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "dados_invalidos" }, { status: 400 });
  }
  const d = parsed.data;

  const [existe] = await db
    .select({ id: frotas.id })
    .from(frotas)
    .where(eq(frotas.numero, d.numero.trim()))
    .limit(1);
  if (existe) {
    return NextResponse.json(
      {
        error: "frota_duplicada",
        mensagem: `Já existe frota com número ${d.numero}.`,
      },
      { status: 409 }
    );
  }

  const [f] = await db
    .insert(frotas)
    .values({
      ...d,
      numero: d.numero.trim(),
      ativo: typeof d.ativo === "boolean" ? (d.ativo ? 1 : 0) : d.ativo,
    })
    .returning();
  return NextResponse.json({ frota: f }, { status: 201 });
}
