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
  const [excluirId, setExcluirId] = useState<number | null>(null);
  const [excluindo, setExcluindo] = useState(false);
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
            placeholder="Buscar peça por nome ou código…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {isAdmin && (
          <div className="ml-auto flex items-center gap-2">
            <Link href="/compras/nova" className="btn-secondary !text-xs">
              Solicitar compra
            </Link>
            <button className="btn-primary" onClick={() => setNova(true)}>
              <span className="text-base leading-none">＋</span>
              Cadastrar peça
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Res n={r.total} label="Peças" hint="cadastradas" />
        <Res
          n={r.repor}
          label="Repor"
          hint="abaixo do mínimo"
          tone={r.repor > 0 ? "warning" : undefined}
        />
        <Res
          n={r.criticos}
          label="Críticas"
          hint="saldo zerado"
          tone={r.criticos > 0 ? "danger" : undefined}
        />
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
                <tr
                  key={p.id}
                  className="border-t transition"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-3 py-2.5">
                    <div
                      className="font-semibold"
                      style={{ color: "var(--text)" }}
                    >
                      {p.nome}
                    </div>
                    {p.codigo && (
                      <div
                        className="font-mono text-[10px] uppercase tracking-widest"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {p.codigo}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className="font-mono text-base font-black tabular-nums"
                      style={{
                        color: critico
                          ? "var(--danger)"
                          : repor
                          ? "var(--warning)"
                          : "var(--text)",
                      }}
                    >
                      {p.saldo}
                    </span>
                  </td>
                  <td
                    className="px-3 py-2.5 font-mono text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {p.unidade}
                  </td>
                  <td
                    className="px-3 py-2.5 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {p.localizacao || "—"}
                  </td>
                  <td
                    className="px-3 py-2.5 text-right font-mono text-xs tabular-nums"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {p.minimo} / {p.maximo}
                  </td>
                  <td className="px-3 py-2.5">
                    {critico ? (
                      <span className="chip chip-danger">Crítico</span>
                    ) : repor ? (
                      <span className="chip chip-warning">Repor</span>
                    ) : (
                      <span className="chip chip-brand">OK</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {isAdmin ? (
                      <div className="flex justify-end gap-1">
                        <button
                          className="btn-ghost"
                          onClick={() => setAjusteId(p.id)}
                        >
                          Ajustar
                        </button>
                        <Link
                          href={{
                            pathname: "/compras/nova",
                            query: { peca: p.id },
                          }}
                          className="btn-ghost"
                        >
                          Comprar
                        </Link>
                        <button
                          className="btn-ghost"
                          onClick={() => setExcluirId(p.id)}
                          title="Excluir peça"
                          style={{ color: "var(--danger)" }}
                        >
                          🗑
                        </button>
                      </div>
                    ) : (
                      <span
                        className="font-mono text-[10px] uppercase tracking-widest"
                        style={{ color: "var(--text-dim)" }}
                      >
                        —
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
                  className="px-3 py-10 text-center"
                  style={{ color: "var(--text-dim)" }}
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
      {excluirId != null && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setExcluirId(null)}
        >
          <div
            className="card w-full max-w-md p-5"
            style={{ boxShadow: "var(--shadow-md)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold tracking-tight">
              Excluir esta peça?
            </h3>
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              {pecas.find((p) => p.id === excluirId)?.nome} —{" "}
              {pecas.find((p) => p.id === excluirId)?.codigo ?? "sem código"}.
              Isso é PERMANENTE. Só é permitido se não houver pedidos em
              andamento.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() => setExcluirId(null)}
                type="button"
              >
                Voltar
              </button>
              <button
                className="btn-danger"
                disabled={excluindo}
                onClick={async () => {
                  setExcluindo(true);
                  const res = await fetch(`/api/estoque/${excluirId}`, {
                    method: "DELETE",
                  });
                  setExcluindo(false);
                  if (!res.ok) {
                    const j = await res.json().catch(() => ({}));
                    alert(j.mensagem ?? "Falha ao excluir.");
                    return;
                  }
                  setExcluirId(null);
                  mutate();
                }}
              >
                {excluindo ? "Excluindo…" : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
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
        "px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-widest",
        className
      )}
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </th>
  );
}

function Res({
  n,
  label,
  hint,
  tone,
}: {
  n: number;
  label: string;
  hint: string;
  tone?: "danger" | "warning";
}) {
  const color =
    tone === "danger"
      ? "var(--danger)"
      : tone === "warning"
      ? "var(--warning)"
      : "var(--text)";
  const border =
    tone === "danger"
      ? "var(--danger-border)"
      : tone === "warning"
      ? "var(--warning-soft)"
      : "var(--border)";
  return (
    <div className="card px-3.5 py-3" style={{ borderColor: border }}>
      <div
        className="font-mono text-3xl font-black leading-none tabular-nums"
        style={{ color }}
      >
        {n}
      </div>
      <div
        className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-dim)" }}>
        {hint}
      </div>
    </div>
  );
}
