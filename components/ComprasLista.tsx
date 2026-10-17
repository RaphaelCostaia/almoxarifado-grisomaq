"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import clsx from "clsx";
import { STATUS_COMPRA_LABELS, type Compra } from "@/db/schema";
import { formatBR, formatBRDia } from "@/lib/date";
import { useIsAdmin } from "./SessionProvider";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const FILTROS: { key: "todos" | Compra["status"]; label: string }[] = [
  { key: "todos", label: "Todas" },
  { key: "rascunho", label: "Rascunho" },
  { key: "aprovada", label: "Aprovadas" },
  { key: "comprada", label: "Compradas" },
  { key: "recebida", label: "Recebidas" },
  { key: "cancelada", label: "Canceladas" },
];

function statusStyle(status: Compra["status"]): React.CSSProperties {
  const map: Record<Compra["status"], { bg: string; color: string }> = {
    rascunho: { bg: "var(--surface-3)", color: "var(--text-muted)" },
    aprovada: { bg: "var(--info-soft)", color: "var(--info)" },
    comprada: { bg: "var(--warning-soft)", color: "var(--warning)" },
    recebida: { bg: "var(--brand-soft)", color: "var(--brand)" },
    cancelada: { bg: "var(--danger-soft)", color: "var(--danger)" },
  };
  const s = map[status];
  return { background: s.bg, color: s.color };
}

export function ComprasLista() {
  const isAdmin = useIsAdmin();
  const [status, setStatus] = useState<"todos" | Compra["status"]>("todos");
  const [q, setQ] = useState("");
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== "todos") params.set("status", status);
  const { data } = useSWR<{ compras: Compra[] }>(
    `/api/compras?${params}`,
    fetcher,
    { refreshInterval: 5000 }
  );
  const compras = data?.compras ?? [];

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2 p-2.5">
        <div className="relative min-w-[240px] flex-1">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            ⌕
          </span>
          <input
            className="input-base pl-8"
            placeholder="Buscar por peça ou fornecedor…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-0.5">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className="tab-link"
              data-active={status === f.key}
            >
              {f.label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <Link className="btn-primary ml-auto" href="/compras/nova">
            <span className="text-base leading-none">＋</span>
            Nova solicitação
          </Link>
        )}
      </div>

      <div className="space-y-1.5">
        {compras.map((c) => (
          <Link
            key={c.id}
            href={`/compras/${c.id}`}
            className="card card-hover flex flex-wrap items-center gap-3 px-3.5 py-3"
          >
            <span
              className="inline-flex shrink-0 items-center rounded px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest"
              style={statusStyle(c.status)}
            >
              {STATUS_COMPRA_LABELS[c.status]}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className="text-[14px] font-semibold"
                style={{ color: "var(--text)" }}
              >
                <span
                  className="mr-1.5 font-mono text-xs font-bold tabular-nums"
                  style={{ color: "var(--text-muted)" }}
                >
                  #{c.id} · {c.quantidade} {c.unidade}
                </span>
                {c.descricao}
              </div>
              <div
                className="mt-0.5 flex items-center gap-2 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                <span>{c.fornecedor ?? "sem fornecedor"}</span>
                {c.prazo && (
                  <>
                    <span>·</span>
                    <span className="font-mono tabular-nums">
                      prazo {formatBRDia(c.prazo)}
                    </span>
                  </>
                )}
                {c.pedidoId && (
                  <>
                    <span>·</span>
                    <span className="chip">pedido #{c.pedidoId}</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              {isAdmin && c.status === "recebida" && c.valorTotal && (
                <div
                  className="font-mono text-sm font-bold tabular-nums"
                  style={{ color: "var(--brand)" }}
                  title="Valor efetivamente pago"
                >
                  R$ {c.valorTotal}
                </div>
              )}
              <div
                className="font-mono text-[10px] tabular-nums"
                style={{ color: "var(--text-dim)" }}
              >
                {formatBR(c.criadoEm)}
              </div>
            </div>
          </Link>
        ))}
        {compras.length === 0 && (
          <div
            className="card p-8 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Nenhuma solicitação de compra por aqui.
          </div>
        )}
      </div>
    </div>
  );
}
