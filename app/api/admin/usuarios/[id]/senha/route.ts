import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { usuarios } from "@/db/schema";
import { exigirAdminApi } from "@/lib/api-auth";
import { hashSenha } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  senha: z.string().min(6).max(128),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;
  const id = Number(params.id);
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "dados_invalidos" }, { status: 400 });
  }
  const hash = await hashSenha(parsed.data.senha);
  await db.update(usuarios).set({ senhaHash: hash }).where(eq(usuarios.id, id));
  return NextResponse.json({ ok: true });
}
