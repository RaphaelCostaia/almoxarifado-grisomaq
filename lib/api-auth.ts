import { NextResponse } from "next/server";
import { sessaoAtual, type SessionPayload } from "./auth";

export async function exigirSessaoApi(): Promise<
  { ok: true; sessao: SessionPayload } | { ok: false; res: NextResponse }
> {
  const s = await sessaoAtual();
  if (!s) {
    return {
      ok: false,
      res: NextResponse.json({ error: "nao_autenticado" }, { status: 401 }),
    };
  }
  return { ok: true, sessao: s };
}

export async function exigirAdminApi(): Promise<
  { ok: true; sessao: SessionPayload } | { ok: false; res: NextResponse }
> {
  const r = await exigirSessaoApi();
  if (!r.ok) return r;
  if (r.sessao.role !== "admin") {
    return {
      ok: false,
      res: NextResponse.json({ error: "somente_admin" }, { status: 403 }),
    };
  }
  return r;
}
