"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import clsx from "clsx";
import {
  STATUS_COMPRA_LABELS,
  STATUS_COMPRA_TRILHO,
  type Compra,
} from "@/db/schema";
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
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-oliva-100 bg-creme-50 p-3 shadow-sm">
        <div className="relative min-w-[240px] flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-oliva-500">
            🔎
          </span>
          <input
            className="input-base pl-9"
            placeholder="Buscar por peça ou fornecedor…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-semibold",
                status === f.key
                  ? "bg-oliva-600 text-white"
                  : "bg-white text-oliva-800 hover:bg-oliva-50"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <Link className="btn-primary ml-auto" href="/compras/nova">
            + Nova solicitação de compra
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {compras.map((c) => (
          <Link
            key={c.id}
            href={`/compras/${c.id}`}
            className="card-base flex flex-wrap items-center gap-3 border p-3 hover:shadow-md"
          >
            <span
              className={clsx(
                "chip !text-white",
                c.status === "rascunho"
                  ? "!bg-neutral-500"
                  : c.status === "aprovada"
                  ? "!bg-blue-500"
                  : c.status === "comprada"
                  ? "!bg-amber-600"
                  : c.status === "recebida"
                  ? "!bg-oliva-600"
                  : "!bg-red-600"
              )}
            >
              {STATUS_COMPRA_LABELS[c.status]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-oliva-900">
                <span className="mr-1 font-mono text-oliva-700">
                  #{c.id} · {c.quantidade} {c.unidade} ·
                </span>
                {c.descricao}
              </div>
              <div className="text-xs text-oliva-700">
                {c.fornecedor ?? "Fornecedor pendente"}
                {c.prazo && (
                  <span className="ml-2 font-mono">
                    prazo {formatBRDia(c.prazo)}
                  </span>
                )}
                {c.pedidoId && (
                  <span className="chip ml-2 !bg-creme-100">
                    pedido #{c.pedidoId}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              {c.valorTotal && (
                <div className="font-mono text-sm font-bold text-oliva-900">
                  R$ {c.valorTotal}
                </div>
              )}
              <div className="text-[11px] font-mono text-oliva-600">
                {formatBR(c.criadoEm)}
              </div>
            </div>
          </Link>
        ))}
        {compras.length === 0 && (
          <div className="rounded-md border border-oliva-100 bg-creme-50 p-8 text-center text-sm text-oliva-700">
            Nenhuma solicitação de compra por aqui.
          </div>
        )}
      </div>
    </div>
  );
}
