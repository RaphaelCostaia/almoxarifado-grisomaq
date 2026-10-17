"use client";

import useSWR from "swr";
import {
  STATUS_PEDIDO_LABELS,
  STATUS_COMPRA_LABELS,
  type Pedido,
  type Compra,
} from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type DadosDashboard = {
  totalPedidos: number;
  porStatus: { status: Pedido["status"]; c: number }[];
  topPecas: { descricao: string; c: number }[];
  topFrotas: { frota: string; c: number }[];
  tempoMedioDias: number;
  gastoMes: { total: number; c: number };
  topFornecedores: { fornecedor: string; total: number; c: number }[];
  serieDiaria: { label: string; c: number }[];
  comprasPorStatus: { status: Compra["status"]; c: number }[];
  aguardandoChegar: { c: number; total: number };
};

export function Dashboard() {
  const { data } = useSWR<DadosDashboard>("/api/dashboard", fetcher, {
    refreshInterval: 15000,
  });

  if (!data) {
    return (
      <div className="text-sm" style={{ color: "var(--text-muted)" }}>
        Carregando indicadores…
      </div>
    );
  }

  const maxSerieDiaria = Math.max(1, ...data.serieDiaria.map((s) => s.c));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <div>
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Indicadores
          </div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <span
          className="ml-auto font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          atualizado a cada 15s
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi
          n={data.totalPedidos}
          label="Total de pedidos"
          hint="desde o início"
        />
        <Kpi
          n={data.aguardandoChegar?.c ?? 0}
          label="Aguardando chegar"
          hint="compras já feitas ao fornecedor"
          tone={(data.aguardandoChegar?.c ?? 0) > 0 ? "warning" : undefined}
        />
        <Kpi
          n={data.gastoMes.c}
          label="Compras recebidas"
          hint="últimos 30d"
        />
        <Kpi
          value={`R$ ${data.gastoMes.total.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}`}
          label="Gasto no mês"
          hint="pago (compras recebidas)"
          tone="brand"
        />
        <Kpi
          value={
            data.tempoMedioDias > 0 && data.tempoMedioDias < 0.5
              ? "< 1 dia"
              : Math.max(0, data.tempoMedioDias).toFixed(1) + " d"
          }
          label="Tempo médio"
          hint="do pedido à entrega"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card titulo="Pedidos criados por dia" subtitulo="últimos 14 dias">
          <div className="flex h-40 items-end gap-1">
            {data.serieDiaria.map((s) => (
              <div key={s.label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm"
                  style={{
                    height: `${(s.c / maxSerieDiaria) * 100}%`,
                    background: "var(--brand)",
                    minHeight: s.c > 0 ? "4px" : "0",
                  }}
                  title={`${s.label}: ${s.c}`}
                />
                <div
                  className="font-mono text-[9px] tabular-nums"
                  style={{ color: "var(--text-muted)" }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card titulo="Pedidos por status" subtitulo="tempo real">
          <div className="space-y-2">
            {data.porStatus.length === 0 && (
              <div
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Sem pedidos cadastrados ainda.
              </div>
            )}
            {data.porStatus.map((s) => {
              const total = data.porStatus.reduce((a, b) => a + b.c, 0);
              const pct = total > 0 ? (s.c / total) * 100 : 0;
              return (
                <div key={s.status} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text)" }}>
                      {STATUS_PEDIDO_LABELS[s.status]}
                    </span>
                    <span
                      className="font-mono tabular-nums"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {s.c} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full"
                    style={{ background: "var(--surface-3)" }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${pct}%`,
                        background:
                          s.status === "cancelada"
                            ? "var(--danger)"
                            : s.status === "entregue"
                            ? "var(--brand)"
                            : "var(--info)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card titulo="Compras por status" subtitulo="tempo real">
          <div className="space-y-2">
            {(!data.comprasPorStatus || data.comprasPorStatus.length === 0) && (
              <div
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Sem solicitações de compra ainda.
              </div>
            )}
            {(data.comprasPorStatus ?? []).map((s) => {
              const total = (data.comprasPorStatus ?? []).reduce(
                (a, b) => a + b.c,
                0
              );
              const pct = total > 0 ? (s.c / total) * 100 : 0;
              return (
                <div key={s.status} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text)" }}>
                      {STATUS_COMPRA_LABELS[s.status]}
                    </span>
                    <span
                      className="font-mono tabular-nums"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {s.c} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full"
                    style={{ background: "var(--surface-3)" }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${pct}%`,
                        background:
                          s.status === "cancelada"
                            ? "var(--danger)"
                            : s.status === "recebida"
                            ? "var(--brand)"
                            : s.status === "comprada"
                            ? "var(--warning)"
                            : s.status === "aprovada"
                            ? "var(--info)"
                            : "var(--text-muted)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card titulo="Peças mais pedidas" subtitulo="últimos 30 dias">
          <BarList
            items={data.topPecas.map((p) => ({
              label: p.descricao,
              value: p.c,
            }))}
            empty="Sem pedidos no período."
          />
        </Card>

        <Card titulo="Frotas com mais pedidos" subtitulo="últimos 30 dias">
          <BarList
            items={data.topFrotas.map((f) => ({
              label: f.frota,
              value: f.c,
            }))}
            empty="Sem pedidos no período."
          />
        </Card>

        <Card
          titulo="Top fornecedores"
          subtitulo="por valor comprado · últimos 90 dias"
        >
          {data.topFornecedores.length === 0 ? (
            <div
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Sem compras recebidas no período.
            </div>
          ) : (
            <div className="space-y-2">
              {data.topFornecedores.map((f) => (
                <div
                  key={f.fornecedor}
                  className="flex items-center justify-between text-xs"
                >
                  <span
                    className="truncate font-semibold"
                    style={{ color: "var(--text)" }}
                  >
                    {f.fornecedor}
                  </span>
                  <div className="flex items-center gap-3">
                    <span
                      className="font-mono tabular-nums"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {f.c}×
                    </span>
                    <span
                      className="font-mono font-bold tabular-nums"
                      style={{ color: "var(--brand)" }}
                    >
                      R$ {f.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  n,
  value,
  label,
  hint,
  tone,
}: {
  n?: number;
  value?: string;
  label: string;
  hint: string;
  tone?: "brand" | "warning" | "danger";
}) {
  const color =
    tone === "brand"
      ? "var(--brand)"
      : tone === "warning"
      ? "var(--warning)"
      : tone === "danger"
      ? "var(--danger)"
      : "var(--text)";
  return (
    <div className="card px-3.5 py-3">
      <div
        className="font-mono text-2xl font-black leading-none tabular-nums"
        style={{ color }}
      >
        {value ?? n}
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

function Card({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="mb-3">
        <div
          className="text-sm font-bold"
          style={{ color: "var(--text)" }}
        >
          {titulo}
        </div>
        {subtitulo && (
          <div
            className="mt-0.5 font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            {subtitulo}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function BarList({
  items,
  empty,
}: {
  items: { label: string; value: number }[];
  empty: string;
}) {
  if (items.length === 0) {
    return (
      <div className="text-sm" style={{ color: "var(--text-muted)" }}>
        {empty}
      </div>
    );
  }
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-1.5">
      {items.map((it) => (
        <div key={it.label} className="text-xs">
          <div className="flex items-center justify-between">
            <span
              className="truncate"
              style={{ color: "var(--text)" }}
              title={it.label}
            >
              {it.label}
            </span>
            <span
              className="font-mono tabular-nums"
              style={{ color: "var(--text-muted)" }}
            >
              {it.value}
            </span>
          </div>
          <div
            className="mt-0.5 h-1 overflow-hidden rounded-full"
            style={{ background: "var(--surface-3)" }}
          >
            <div
              className="h-full"
              style={{
                width: `${(it.value / max) * 100}%`,
                background: "var(--brand)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
