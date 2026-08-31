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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Item n={k.emAberto} label="Em aberto" />
      <Item n={k.urgentes} label="Urgentes" tone={k.urgentes > 0 ? "vermelho" : undefined} />
      <Item n={k.emAtraso} label="Em atraso (2d+)" tone={k.emAtraso > 0 ? "amarelo" : undefined} />
      <Item n={k.entregues7d} label="Entregues (7d)" />
    </div>
  );
}

function Item({
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
      <div className="text-3xl font-black leading-none text-oliva-900">
        {n}
      </div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-oliva-700">
        {label}
      </div>
    </div>
  );
}
