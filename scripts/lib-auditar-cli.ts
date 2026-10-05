// Helper de auditoria pra scripts CLI (sem NextRequest).
// Replica a hash-chain SHA-256 do lib/auditar.ts, mas aceita um "ator"
// de linha de comando (nome do operador, defaults pra "cli-script").
//
// Importante: grava DENTRO de uma transação existente — passe o `tx` do
// db.transaction() como primeiro argumento. Isso garante que o audit só
// é persistido se o UPDATE/INSERT da operação principal também commitar.

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { auditLog } from "../db/schema";
import type { AuditAcao, AuditEntidade } from "../lib/audit-acoes";

const ZERO_HASH = "0".repeat(64);

type AuditarCliInput = {
  acao: AuditAcao;
  entidade?: AuditEntidade;
  entidadeId?: number | null;
  resumo: string;
  diff?: unknown;
  atorNome?: string;
};

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

export async function auditarCli(
  tx: any,
  input: AuditarCliInput
): Promise<void> {
  const { acao, entidade, entidadeId, resumo, diff, atorNome } = input;
  const rows = (await tx.execute(
    sql`SELECT hash_curr FROM audit_log ORDER BY id DESC LIMIT 1 FOR UPDATE`
  )) as unknown as { hash_curr: string }[];
  const hashPrev = rows[0]?.hash_curr ?? ZERO_HASH;

  const linhaCanonica = {
    acao,
    atorNome: atorNome ?? "cli-script",
    atorRole: "admin",
    atorUid: null,
    diff: diff ?? null,
    entidade: entidade ?? null,
    entidadeId: entidadeId ?? null,
    hashPrev,
    ip: null,
    requestId: null,
    resumo: resumo.slice(0, 255),
    userAgent: "tsx/cli",
  };
  const hashCurr = createHash("sha256")
    .update(hashPrev + canonicalJson(linhaCanonica))
    .digest("hex");

  await tx.insert(auditLog).values({
    acao,
    atorNome: atorNome ?? "cli-script",
    atorRole: "admin",
    atorUid: null,
    diff: (diff ?? null) as any,
    entidade: entidade ?? null,
    entidadeId: entidadeId ?? null,
    hashPrev,
    hashCurr,
    ip: null,
    requestId: null,
    resumo: resumo.slice(0, 255),
    userAgent: "tsx/cli",
  });
}
