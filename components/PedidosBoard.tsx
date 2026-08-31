"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { STATUS_PEDIDO_LABELS, type Pedido } from "@/db/schema";
import { KPIBar } from "./KPIBar";
import { TopBar } from "./TopBar";
import { KanbanColuna } from "./KanbanColuna";
import { NovoPedidoDialog } from "./NovoPedidoDialog";
import { PedidoDetalheDialog } from "./PedidoDetalheDialog";
import { diasDesde } from "@/lib/date";
import { useIsAdmin } from "./SessionProvider";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const COLUNAS: { key: Pedido["status"]; label: string; dot: string }[] = [
  { key: "solicitada", label: "Solicitada", dot: "bg-blue-500" },
  { key: "providenciando", label: "Providenciando", dot: "bg-amber-500" },
  { key: "aguardando_buscar", label: "Aguardando buscar", dot: "bg-purple-500" },
  { key: "aguardando_retirada", label: "Aguardando retirada", dot: "bg-teal-500" },
  { key: "entregue", label: "Entregue", dot: "bg-oliva-500" },
  { key: "cancelada", label: "Cancelado", dot: "bg-neutral-400" },
];

export function PedidosBoard() {
  const isAdmin = useIsAdmin();
  const [q, setQ] = useState("");
  const [frota, setFrota] = useState("todas");
  const [soUrgentes, setSoUrgentes] = useState(false);
  const [soAtraso, setSoAtraso] = useState(false);
  const [ocultarFinalizados, setOcultarFinalizados] = useState(false);
  const [novo, setNovo] = useState(false);
  const [detalheId, setDetalheId] = useState<number | null>(null);
  const [seenIds, setSeenIds] = useState<Set<number>>(new Set());

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (frota !== "todas") params.set("frota", frota);
  if (soUrgentes) params.set("urgente", "1");
  if (ocultarFinalizados) params.set("ocultarFinalizados", "1");

  const { data, isLoading, mutate } = useSWR<{
    pedidos: Pedido[];
    frotas: string[];
  }>(`/api/pedidos?${params.toString()}`, fetcher, {
    refreshInterval: 4000,
    revalidateOnFocus: true,
  });

  const pedidos = useMemo(() => {
    let list = data?.pedidos ?? [];
    if (soAtraso) {
      list = list.filter(
        (p) =>
          !["entregue", "cancelada"].includes(p.status) &&
          diasDesde(p.atualizadoEm) >= 2
      );
    }
    return list;
  }, [data, soAtraso]);

  // Detecta novos urgentes para animar
  const novosUrgentes = useMemo(() => {
    const set = new Set<number>();
    for (const p of pedidos) {
      if (p.prioridade === "urgente" && !seenIds.has(p.id)) set.add(p.id);
    }
    return set;
  }, [pedidos, seenIds]);

  useEffect(() => {
    if (pedidos.length > 0 && seenIds.size === 0) {
      setSeenIds(new Set(pedidos.map((p) => p.id)));
      return;
    }
    if (novosUrgentes.size > 0) {
      const timer = setTimeout(() => {
        setSeenIds((prev) => {
          const next = new Set(prev);
          for (const id of novosUrgentes) next.add(id);
          return next;
        });
      }, 4200);
      return () => clearTimeout(timer);
    }
  }, [pedidos, novosUrgentes, seenIds.size]);

  const porStatus = useMemo(() => {
    const map = new Map<Pedido["status"], Pedido[]>();
    for (const c of COLUNAS) map.set(c.key, []);
    for (const p of pedidos) map.get(p.status)?.push(p);
    return map;
  }, [pedidos]);

  return (
    <div className="space-y-4">
      <TopBar
        q={q}
        onQ={setQ}
        frota={frota}
        frotas={data?.frotas ?? []}
        onFrota={setFrota}
        soUrgentes={soUrgentes}
        onSoUrgentes={setSoUrgentes}
        soAtraso={soAtraso}
        onSoAtraso={setSoAtraso}
        ocultarFinalizados={ocultarFinalizados}
        onOcultarFinalizados={setOcultarFinalizados}
        onNovoPedido={() => setNovo(true)}
      />
      <KPIBar />

      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUNAS.map((col) => (
          <KanbanColuna
            key={col.key}
            titulo={col.label}
            dot={col.dot}
            pedidos={porStatus.get(col.key) ?? []}
            destacarUrgentes={novosUrgentes}
            arrastavel={isAdmin}
            onAbrir={(id) => setDetalheId(id)}
            onDrop={
              isAdmin
                ? async (pedidoId) => {
                    const p = pedidos.find((x) => x.id === pedidoId);
                    if (!p || p.status === col.key) return;
                    await fetch(`/api/pedidos/${pedidoId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: col.key }),
                    });
                    mutate();
                  }
                : undefined
            }
          />
        ))}
      </div>

      {isLoading && !data && (
        <div className="rounded-md border border-oliva-100 bg-creme-50 p-4 text-sm text-oliva-700">
          Carregando pedidos…
        </div>
      )}

      {novo && (
        <NovoPedidoDialog
          onClose={() => setNovo(false)}
          onCreated={() => {
            setNovo(false);
            mutate();
          }}
        />
      )}
      {detalheId != null && (
        <PedidoDetalheDialog
          id={detalheId}
          onClose={() => setDetalheId(null)}
          onChanged={() => mutate()}
        />
      )}
    </div>
  );
}

