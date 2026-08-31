"use client";

import { useState } from "react";
import useSWR from "swr";
import clsx from "clsx";
import Link from "next/link";
import type { Peca } from "@/db/schema";
import { NovaPecaDialog } from "./NovaPecaDialog";
import { AjusteSaldoDialog } from "./AjusteSaldoDialog";
import { useIsAdmin } from "./SessionProvider";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function EstoqueLista() {
  const isAdmin = useIsAdmin();
  const [q, setQ] = useState("");
  const [nova, setNova] = useState(false);
  const [ajusteId, setAjusteId] = useState<number | null>(null);
  const { data, mutate } = useSWR<{
    pecas: Peca[];
    resumo: { total: number; repor: number; criticos: number };
  }>(`/api/estoque?q=${encodeURIComponent(q)}`, fetcher, {
    refreshInterval: 5000,
  });

  const pecas = data?.pecas ?? [];
  const r = data?.resumo ?? { total: 0, repor: 0, criticos: 0 };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-oliva-100 bg-creme-50 p-3 shadow-sm">
        <div className="relative min-w-[240px] flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-oliva-500">
            🔎
          </span>
          <input
            className="input-base pl-9"
            placeholder="Buscar peça por nome ou código…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {isAdmin && (
          <div className="ml-auto flex items-center gap-2">
            <Link href="/compras/nova" className="btn-secondary">
              📝 Nova solicitação de compra
            </Link>
            <button className="btn-primary" onClick={() => setNova(true)}>
              + Cadastrar peça
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Res
          n={r.total}
          label="Peças cadastradas"
        />
        <Res
          n={r.repor}
          label="Precisam repor"
          tone={r.repor > 0 ? "amarelo" : undefined}
        />
        <Res
          n={r.criticos}
          label="Zeradas / críticas"
          tone={r.criticos > 0 ? "vermelho" : undefined}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-oliva-100 bg-creme-50 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-oliva-800 text-creme-50">
            <tr>
              <Th>Peça</Th>
              <Th className="text-right">Saldo</Th>
              <Th>Un.</Th>
              <Th>Localização</Th>
              <Th className="text-right">Min/Max</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {pecas.map((p) => {
              const critico = p.saldo === 0;
              const repor = p.saldo > 0 && p.saldo <= p.minimo;
              return (
                <tr key={p.id} className="border-t border-oliva-100">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-oliva-900">{p.nome}</div>
                    {p.codigo && (
                      <div className="font-mono text-[11px] text-oliva-600">
                        {p.codigo}
                      </div>
                    )}
                  </td>
                  <td
                    className={clsx(
                      "px-3 py-2 text-right font-mono font-bold",
                      critico
                        ? "text-red-600"
                        : repor
                        ? "text-amber-700"
                        : "text-oliva-900"
                    )}
                  >
                    {p.saldo}
                  </td>
                  <td className="px-3 py-2 text-oliva-700">{p.unidade}</td>
                  <td className="px-3 py-2 text-oliva-700">
                    {p.localizacao || "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-oliva-700">
                    {p.minimo} / {p.maximo}
                  </td>
                  <td className="px-3 py-2">
                    {critico ? (
                      <span className="chip !bg-red-100 !text-red-700">
                        Crítico
                      </span>
                    ) : repor ? (
                      <span className="chip !bg-amber-100 !text-amber-800">
                        Repor
                      </span>
                    ) : (
                      <span className="chip !bg-oliva-50 !text-oliva-800">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isAdmin ? (
                      <>
                        <button
                          className="btn-ghost text-xs"
                          onClick={() => setAjusteId(p.id)}
                        >
                          Ajustar saldo
                        </button>
                        <Link
                          href={{
                            pathname: "/compras/nova",
                            query: { peca: p.id },
                          }}
                          className="btn-ghost text-xs"
                        >
                          Solicitar compra
                        </Link>
                      </>
                    ) : (
                      <span className="text-[11px] opacity-50">
                        somente leitura
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {pecas.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-oliva-500"
                >
                  Nenhuma peça encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nova && (
        <NovaPecaDialog
          onClose={() => setNova(false)}
          onCreated={() => {
            setNova(false);
            mutate();
          }}
        />
      )}
      {ajusteId != null && (
        <AjusteSaldoDialog
          pecaId={ajusteId}
          onClose={() => setAjusteId(null)}
          onSaved={() => {
            setAjusteId(null);
            mutate();
          }}
        />
      )}
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={clsx(
        "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest",
        className
      )}
    >
      {children}
    </th>
  );
}

function Res({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone?: "vermelho" | "amarelo";
}) {
  const border =
    tone === "vermelho"
      ? "border-red-300"
      : tone === "amarelo"
      ? "border-amber-300"
      : "border-oliva-100";
  return (
    <div className={`card-base border ${border} px-4 py-3`}>
      <div className="text-3xl font-black leading-none text-oliva-900">{n}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-oliva-700">
        {label}
      </div>
    </div>
  );
}
