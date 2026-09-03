"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import type { AuditLog } from "@/db/schema";
import { AUDIT_ACOES, AUDIT_ACAO_LABELS } from "@/lib/audit-acoes";
import { formatBR } from "@/lib/date";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ENTIDADES = [
  { key: "todas", label: "Todas" },
  { key: "pedido", label: "Pedidos" },
  { key: "compra", label: "Compras" },
  { key: "peca", label: "Peças" },
  { key: "frota", label: "Frotas" },
  { key: "usuario", label: "Usuários" },
  { key: "sessao", label: "Sessão" },
  { key: "arquivo", label: "Arquivos" },
  { key: "export", label: "Exports" },
];

const LIMIT = 50;

export function AuditoriaLista() {
  const [q, setQ] = useState("");
  const [ator, setAtor] = useState("");
  const [entidade, setEntidade] = useState("todas");
  const [acao, setAcao] = useState("todas");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [pagina, setPagina] = useState(0);
  const [detalhe, setDetalhe] = useState<AuditLog | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [resultadoVerif, setResultadoVerif] = useState<
    null | { ok: boolean; total: number; primeiraDivergencia?: number }
  >(null);

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (ator) params.set("ator", ator);
  if (entidade !== "todas") params.set("entidade", entidade);
  if (acao !== "todas") params.set("acao", acao);
  if (de) params.set("de", de);
  if (ate) params.set("ate", ate);
  params.set("limit", String(LIMIT));
  params.set("offset", String(pagina * LIMIT));

  const { data } = useSWR<{ log: AuditLog[]; total: number }>(
    `/api/admin/auditoria?${params}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const rows = data?.log ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / LIMIT));

  const exportUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (ator) p.set("ator", ator);
    if (entidade !== "todas") p.set("entidade", entidade);
    if (acao !== "todas") p.set("acao", acao);
    if (de) p.set("de", de);
    if (ate) p.set("ate", ate);
    return `/api/admin/auditoria/export?${p}`;
  }, [q, ator, entidade, acao, de, ate]);

  async function verificarIntegridade() {
    setVerificando(true);
    setResultadoVerif(null);
    try {
      const res = await fetch("/api/admin/auditoria/verificar", {
        method: "POST",
      });
      const j = await res.json();
      setResultadoVerif(j);
    } finally {
      setVerificando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div>
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Administração
          </div>
          <h1 className="text-xl font-bold tracking-tight">Trilha de auditoria</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Rastro imutável (hash-chain SHA-256) de todas as ações no sistema.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a href={exportUrl} className="btn-secondary" download>
            ⬇ CSV
          </a>
          <button
            className="btn-primary"
            onClick={verificarIntegridade}
            disabled={verificando}
          >
            {verificando ? "Verificando…" : "🔒 Verificar integridade"}
          </button>
        </div>
      </div>

      {resultadoVerif && (
        <div
          className="rounded-md border p-3 text-sm"
          style={
            resultadoVerif.ok
              ? {
                  borderColor: "var(--brand-border)",
                  background: "var(--brand-soft)",
                  color: "var(--brand)",
                }
              : {
                  borderColor: "var(--danger-border)",
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                }
          }
        >
          {resultadoVerif.ok ? (
            <b>✓ Cadeia íntegra</b>
          ) : (
            <b>
              ⚠ CADEIA CORROMPIDA — primeira divergência no id{" "}
              {resultadoVerif.primeiraDivergencia}
            </b>
          )}
          . {resultadoVerif.total.toLocaleString("pt-BR")} linhas verificadas.
        </div>
      )}

      <div className="card grid grid-cols-6 gap-2 p-3">
        <input
          className="input-base col-span-2"
          placeholder="Buscar em resumo, ator, IP…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPagina(0);
          }}
        />
        <input
          className="input-base"
          placeholder="Ator"
          value={ator}
          onChange={(e) => {
            setAtor(e.target.value);
            setPagina(0);
          }}
        />
        <select
          className="input-base"
          value={entidade}
          onChange={(e) => {
            setEntidade(e.target.value);
            setPagina(0);
          }}
        >
          {ENTIDADES.map((e) => (
            <option key={e.key} value={e.key}>
              {e.label}
            </option>
          ))}
        </select>
        <select
          className="input-base"
          value={acao}
          onChange={(e) => {
            setAcao(e.target.value);
            setPagina(0);
          }}
        >
          <option value="todas">Todas as ações</option>
          {AUDIT_ACOES.map((a) => (
            <option key={a} value={a}>
              {AUDIT_ACAO_LABELS[a]}
            </option>
          ))}
        </select>
        <div className="col-span-2 grid grid-cols-2 gap-2">
          <input
            type="date"
            className="input-base"
            value={de}
            onChange={(e) => {
              setDe(e.target.value);
              setPagina(0);
            }}
          />
          <input
            type="date"
            className="input-base"
            value={ate}
            onChange={(e) => {
              setAte(e.target.value);
              setPagina(0);
            }}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b"
              style={{
                background: "var(--surface-3)",
                borderColor: "var(--border)",
              }}
            >
              <Th>#</Th>
              <Th>Quando</Th>
              <Th>Ator</Th>
              <Th>Ação</Th>
              <Th>Resumo</Th>
              <Th>IP</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer border-t transition hover:opacity-90"
                style={{ borderColor: "var(--border)" }}
                onClick={() => setDetalhe(r)}
              >
                <td
                  className="px-3 py-2 font-mono text-[11px] tabular-nums"
                  style={{ color: "var(--text-muted)" }}
                >
                  {r.id}
                </td>
                <td className="px-3 py-2 font-mono text-[11px]">
                  {formatBR(r.ts)}
                </td>
                <td className="px-3 py-2">
                  {r.atorNome ? (
                    <>
                      <div className="font-semibold">{r.atorNome}</div>
                      <div
                        className="font-mono text-[9px] uppercase tracking-widest"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {r.atorRole}
                      </div>
                    </>
                  ) : (
                    <span style={{ color: "var(--text-dim)" }}>—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className="chip"
                    style={{
                      background: "var(--surface-3)",
                      color: "var(--text-muted)",
                      fontSize: 10,
                    }}
                  >
                    {AUDIT_ACAO_LABELS[r.acao as keyof typeof AUDIT_ACAO_LABELS] ??
                      r.acao}
                  </span>
                </td>
                <td className="px-3 py-2">{r.resumo}</td>
                <td
                  className="px-3 py-2 font-mono text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {r.ip ?? "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <span
                    className="font-mono text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    ↗
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-10 text-center"
                  style={{ color: "var(--text-dim)" }}
                >
                  Sem registros com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        className="flex items-center justify-between text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        <div>
          Mostrando <b>{rows.length}</b> de {total.toLocaleString("pt-BR")}{" "}
          registro(s).
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost"
            disabled={pagina === 0}
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
          >
            ← Anterior
          </button>
          <span className="font-mono">
            {pagina + 1} / {totalPaginas}
          </span>
          <button
            className="btn-ghost"
            disabled={pagina + 1 >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima →
          </button>
        </div>
      </div>

      {detalhe && <DetalheModal log={detalhe} onClose={() => setDetalhe(null)} />}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-widest"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </th>
  );
}

function DetalheModal({
  log,
  onClose,
}: {
  log: AuditLog;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto p-4 backdrop-blur-sm"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-3xl p-5"
        style={{ boxShadow: "var(--shadow-md)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div
              className="font-mono text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              Auditoria · #{log.id}
            </div>
            <div className="mt-1 text-lg font-bold">
              {AUDIT_ACAO_LABELS[log.acao as keyof typeof AUDIT_ACAO_LABELS] ??
                log.acao}
            </div>
            <div className="mt-1 text-sm">{log.resumo}</div>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div
          className="grid grid-cols-2 gap-3 border-t pt-3 text-xs"
          style={{ borderColor: "var(--border)" }}
        >
          <Info label="Quando" value={formatBR(log.ts)} mono />
          <Info label="Ator" value={`${log.atorNome ?? "—"} (${log.atorRole ?? "—"})`} />
          <Info label="Entidade" value={`${log.entidade ?? "—"} · ${log.entidadeId ?? "—"}`} />
          <Info label="Request ID" value={log.requestId ?? "—"} mono />
          <Info label="IP" value={log.ip ?? "—"} mono />
          <Info label="User-Agent" value={log.userAgent ?? "—"} />
          <Info label="Hash prev" value={log.hashPrev} mono small />
          <Info label="Hash curr" value={log.hashCurr} mono small />
        </div>

        {log.diff !== null && log.diff !== undefined && (
          <div className="mt-4">
            <div
              className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              Diff / payload
            </div>
            <pre
              className="max-h-96 overflow-auto rounded-md border p-3 text-[11px]"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-3)",
              }}
            >
              {JSON.stringify(log.diff, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div>
      <div
        className="font-mono text-[9px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className={mono ? "font-mono" : ""}
        style={{
          fontSize: small ? 10 : undefined,
          wordBreak: "break-all",
          color: "var(--text)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
