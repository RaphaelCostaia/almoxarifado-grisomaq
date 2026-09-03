import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import type { AuditAcao, AuditEntidade } from "./audit-acoes";

const ZERO_HASH = "0".repeat(64);

type Sessao = { uid: number; nome: string; role: string } | null | undefined;

type AuditarInput = {
  req: NextRequest;
  sessao?: Sessao;
  acao: AuditAcao;
  entidade?: AuditEntidade;
  entidadeId?: number | null;
  resumo: string;
  diff?: unknown;
  requestId?: string | null;
};

function extractIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim().slice(0, 64);
  const real = req.headers.get("x-real-ip");
  if (real) return real.slice(0, 64);
  // next 14 pode ter req.ip; se não, null
  return (req as any).ip ?? null;
}

function extractUA(req: NextRequest): string | null {
  const ua = req.headers.get("user-agent");
  return ua ? ua.slice(0, 512) : null;
}

function extractRequestId(req: NextRequest, override?: string | null): string | null {
  if (override) return override.slice(0, 40);
  const h = req.headers.get("x-request-id");
  return h ? h.slice(0, 40) : null;
}

// JSON canônico — chaves ordenadas — pra hash reprodutível
function canonicalJson(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalJson((v as any)[k]))
      .join(",") +
    "}"
  );
}

/**
 * Grava uma linha em audit_log. Nunca lança erro — se a auditoria falhar,
 * a operação principal segue e o problema vai pra console.error.
 *
 * Encadeamento hash-chain: cada linha carrega o SHA-256 do (hash_prev + JSON
 * canônico dos campos desta linha). Corromper uma linha quebra a cadeia
 * daí pra frente e é detectável pelo endpoint /api/admin/auditoria/verificar.
 */
export async function auditar(input: AuditarInput): Promise<void> {
  try {
    const {
      req,
      sessao,
      acao,
      entidade,
      entidadeId,
      resumo,
      diff,
      requestId,
    } = input;

    const ip = extractIp(req);
    const userAgent = extractUA(req);
    const reqId = extractRequestId(req, requestId);

    await db.transaction(async (tx) => {
      const [ultimo] = await tx.execute<{ hash_curr: string }>(
        sql`SELECT hash_curr FROM audit_log ORDER BY id DESC LIMIT 1 FOR UPDATE`
      );
      const hashPrev = ultimo?.hash_curr ?? ZERO_HASH;

      const linhaCanonica = {
        acao,
        atorNome: sessao?.nome ?? null,
        atorRole: sessao?.role ?? null,
        atorUid: sessao?.uid ?? null,
        diff: diff ?? null,
        entidade: entidade ?? null,
        entidadeId: entidadeId ?? null,
        hashPrev,
        ip,
        requestId: reqId,
        resumo: resumo.slice(0, 255),
        userAgent,
      };
      const hashCurr = createHash("sha256")
        .update(hashPrev + canonicalJson(linhaCanonica))
        .digest("hex");

      await tx.insert(auditLog).values({
        acao,
        atorNome: sessao?.nome ?? null,
        atorRole: sessao?.role ?? null,
        atorUid: sessao?.uid ?? null,
        diff: (diff ?? null) as any,
        entidade: entidade ?? null,
        entidadeId: entidadeId ?? null,
        hashPrev,
        hashCurr,
        ip,
        requestId: reqId,
        resumo: resumo.slice(0, 255),
        userAgent,
      });
    });
  } catch (e) {
    console.error("[audit] falha ao gravar log:", e);
  }
}

/**
 * Recalcula toda a cadeia e detecta se alguma linha foi alterada/removida.
 * Retorna `{ ok, total, primeiraDivergencia? }`.
 */
export async function verificarCadeia(): Promise<{
  ok: boolean;
  total: number;
  primeiraDivergencia?: number;
}> {
  const rows = await db.execute<{
    id: number;
    acao: string;
    ator_nome: string | null;
    ator_role: string | null;
    ator_uid: number | null;
    diff: unknown;
    entidade: string | null;
    entidade_id: number | null;
    ip: string | null;
    request_id: string | null;
    resumo: string;
    user_agent: string | null;
    hash_prev: string;
    hash_curr: string;
  }>(
    sql`SELECT id, acao, ator_nome, ator_role, ator_uid, diff, entidade, entidade_id, ip, request_id, resumo, user_agent, hash_prev, hash_curr FROM audit_log ORDER BY id ASC`
  );

  let hashPrev = ZERO_HASH;
  for (const r of rows) {
    if (r.hash_prev !== hashPrev) {
      return { ok: false, total: rows.length, primeiraDivergencia: r.id };
    }
    const linhaCanonica = {
      acao: r.acao,
      atorNome: r.ator_nome,
      atorRole: r.ator_role,
      atorUid: r.ator_uid,
      diff: r.diff,
      entidade: r.entidade,
      entidadeId: r.entidade_id,
      hashPrev,
      ip: r.ip,
      requestId: r.request_id,
      resumo: r.resumo,
      userAgent: r.user_agent,
    };
    const esperado = createHash("sha256")
      .update(hashPrev + canonicalJson(linhaCanonica))
      .digest("hex");
    if (esperado !== r.hash_curr) {
      return { ok: false, total: rows.length, primeiraDivergencia: r.id };
    }
    hashPrev = r.hash_curr;
  }
  return { ok: true, total: rows.length };
}
