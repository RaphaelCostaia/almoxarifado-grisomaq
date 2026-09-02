"use client";

import { useState } from "react";
import useSWR from "swr";
import clsx from "clsx";
import type { Frota } from "@/db/schema";
import { FrotaEditDialog } from "./FrotaEditDialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Resumo = {
  total: number;
  equipamentos: number;
  implementos: number;
  ativos: number;
  inativos: number;
};

const CATEGORIAS: { key: "todas" | "equipamento" | "implemento"; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "equipamento", label: "Equipamentos" },
  { key: "implemento", label: "Implementos" },
];

const STATUS: { key: "todos" | "ativos" | "inativos"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "ativos", label: "Em operação" },
  { key: "inativos", label: "Baixadas" },
];

export function FrotasLista() {
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState<
    "todas" | "equipamento" | "implemento"
  >("todas");
  const [status, setStatus] = useState<"todos" | "ativos" | "inativos">(
    "ativos"
  );
  const [editar, setEditar] = useState<Frota | "nova" | null>(null);

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (categoria !== "todas") params.set("categoria", categoria);
  if (status !== "todos") params.set("status", status);
  const { data, mutate } = useSWR<{ frotas: Frota[]; resumo: Resumo }>(
    `/api/admin/frotas?${params}`,
    fetcher,
    { refreshInterval: 8000 }
  );

  const rows = data?.frotas ?? [];
  const r = data?.resumo ?? {
    total: 0,
    equipamentos: 0,
    implementos: 0,
    ativos: 0,
    inativos: 0,
  };

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
          <h1 className="text-xl font-bold tracking-tight">
            Frotas & Implementos
          </h1>
        </div>
        <button
          className="btn-primary ml-auto"
          onClick={() => setEditar("nova")}
        >
          <span className="text-base leading-none">＋</span>
          Nova frota
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Res n={r.total} label="Total" />
        <Res n={r.equipamentos} label="Equipamentos" tone="brand" />
        <Res n={r.implementos} label="Implementos" tone="warning" />
        <Res
          n={r.inativos}
          label="Baixadas"
          tone={r.inativos > 0 ? "muted" : undefined}
        />
      </div>

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
            placeholder="Buscar por nº, modelo, marca, placa…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-0.5">
          {CATEGORIAS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategoria(c.key)}
              className="tab-link"
              data-active={categoria === c.key}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div
          className="mx-1 h-6 w-px"
          style={{ background: "var(--border)" }}
        />
        <div className="flex gap-0.5">
          {STATUS.map((s) => (
            <button
              key={s.key}
              onClick={() => setStatus(s.key)}
              className="tab-link"
              data-active={status === s.key}
            >
              {s.label}
            </button>
          ))}
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
              <Th>Nº</Th>
              <Th>Cat.</Th>
              <Th>Modelo</Th>
              <Th>Marca</Th>
              <Th>Ano</Th>
              <Th>Placa</Th>
              <Th>Localização</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr
                key={f.id}
                className="border-t transition"
                style={{ borderColor: "var(--border)" }}
              >
                <td className="px-3 py-2.5">
                  <span
                    className="chip"
                    style={{
                      background:
                        f.categoria === "implemento"
                          ? "var(--warning-soft)"
                          : "var(--brand-soft)",
                      color:
                        f.categoria === "implemento"
                          ? "var(--warning)"
                          : "var(--brand)",
                    }}
                  >
                    {f.numero}
                  </span>
                </td>
                <td
                  className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}
                >
                  {f.categoria === "implemento" ? "IMPL" : "EQUIP"}
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-semibold">{f.modelo || "—"}</div>
                  {f.descricao && (
                    <div
                      className="text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {f.descricao}
                    </div>
                  )}
                </td>
                <td
                  className="px-3 py-2.5 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {f.marca || "—"}
                </td>
                <td
                  className="px-3 py-2.5 font-mono text-xs tabular-nums"
                  style={{ color: "var(--text-muted)" }}
                >
                  {f.ano || "—"}
                </td>
                <td
                  className="px-3 py-2.5 font-mono text-xs"
                  style={{ color: "var(--text)" }}
                >
                  {f.placa || "—"}
                </td>
                <td
                  className="px-3 py-2.5 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {f.localizacao || "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={clsx(
                      "chip",
                      f.ativo === 1 ? "chip-brand" : ""
                    )}
                  >
                    {f.ativo === 1 ? "Em operação" : "Baixada"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    className="btn-ghost"
                    onClick={() => setEditar(f)}
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-10 text-center"
                  style={{ color: "var(--text-dim)" }}
                >
                  Nenhuma frota encontrada com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editar && (
        <FrotaEditDialog
          frota={editar === "nova" ? null : editar}
          onClose={() => setEditar(null)}
          onSaved={() => {
            setEditar(null);
            mutate();
          }}
        />
      )}
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

function Res({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone?: "brand" | "warning" | "muted";
}) {
  const color =
    tone === "brand"
      ? "var(--brand)"
      : tone === "warning"
      ? "var(--warning)"
      : tone === "muted"
      ? "var(--text-muted)"
      : "var(--text)";
  return (
    <div className="card px-3.5 py-3">
      <div
        className="font-mono text-2xl font-black leading-none tabular-nums"
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
    </div>
  );
}
