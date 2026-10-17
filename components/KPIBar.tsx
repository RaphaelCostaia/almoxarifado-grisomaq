"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Kpis = {
  emAberto: number;
  urgentes: number;
  emAtraso: number;
  entregues7d: number;
};

export function KPIBar() {
  const { data } = useSWR<Kpis>("/api/pedidos/kpis", fetcher, {
    refreshInterval: 4000,
  });
  const k = data ?? { emAberto: 0, urgentes: 0, emAtraso: 0, entregues7d: 0 };
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Item n={k.emAberto} label="Em aberto" hint="não entregues" />
      <Item
        n={k.urgentes}
        label="Urgentes"
        hint="prioridade alta"
        tone={k.urgentes > 0 ? "danger" : undefined}
      />
      <Item
        n={k.emAtraso}
        label="Em atraso"
        hint="parados 2d+"
        tone={k.emAtraso > 0 ? "warning" : undefined}
      />
      <Item
        n={k.entregues7d}
        label="Entregues"
        hint="últimos 7 dias"
        tone="brand"
      />
    </div>
  );
}

function Item({
  n,
  label,
  hint,
  tone,
}: {
  n: number;
  label: string;
  hint: string;
  tone?: "danger" | "warning" | "brand";
}) {
  const colorVar =
    tone === "danger"
      ? "var(--danger)"
      : tone === "warning"
      ? "var(--warning)"
      : tone === "brand"
      ? "var(--brand)"
      : "var(--text)";
  const borderVar =
    tone === "danger"
      ? "var(--danger-border)"
      : tone === "warning"
      ? "var(--warning-soft)"
      : "var(--border)";
  return (
    <div
      className="card px-3.5 py-3"
      style={{ borderColor: borderVar }}
    >
      <div className="flex items-baseline justify-between">
        <div
          className="font-mono text-3xl font-black leading-none tabular-nums"
          style={{ color: colorVar }}
        >
          {n}
        </div>
        {tone === "danger" && n > 0 && <span className="live-dot" style={{ background: "var(--danger)", boxShadow: "0 0 0 3px var(--danger-soft)" }} />}
      </div>
      <div
        className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className="mt-0.5 text-[11px]"
        style={{ color: "var(--text-dim)" }}
      >
        {hint}
      </div>
    </div>
  );
}
