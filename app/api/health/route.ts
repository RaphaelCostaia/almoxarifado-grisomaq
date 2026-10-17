// Health check PÚBLICO (sem autenticação).
//
// Usado por:
//  1. Docker HEALTHCHECK (Dockerfile) — pra marcar container como healthy
//  2. Traefik — descoberta de backend disponível
//  3. UptimeRobot / Pingdom / monitoramento externo — avisa quando cai
//
// Resposta:
//  200 { ok: true,  db: "ok"    } — tudo funcionando
//  503 { ok: false, db: "error" } — app vivo mas banco indisponível
//
// Sem informação sensível no payload — propositalmente minimalista.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  try {
    const rows = await db.execute(sql`SELECT 1 as ok`);
    dbOk = Array.isArray(rows) ? rows.length > 0 : !!rows;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? 200 : 503;
  return NextResponse.json(
    {
      ok: dbOk,
      db: dbOk ? "ok" : "error",
      ts: new Date().toISOString(),
    },
    { status }
  );
}
