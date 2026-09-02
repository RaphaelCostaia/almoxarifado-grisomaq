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
  { key: "solicitada", label: "Solicitada", dot: "bg-info" },
  { key: "providenciando", label: "Providenciando", dot: "bg-warning" },
  { key: "aguardando_buscar", label: "Aguardando buscar", dot: "bg-purple-400" },
  { key: "aguardando_retirada", label: "Aguardando retirada", dot: "bg-cyan-400" },
  { key: "entregue", label: "Entregue", dot: "bg-brand" },
  { key: "cancelada", label: "Cancelado", dot: "bg-neutral-500" },
];

const FILTROS_KEY = "grisomaq_filtros_pedidos";
function lerFiltros() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(FILTROS_KEY) ?? "null");
  } catch {
    return null;
  }
}
function salvarFiltros(f: any) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FILTROS_KEY, JSON.stringify(f));
  } catch {}
}

export function PedidosBoard() {
  const isAdmin = useIsAdmin();
  const [q, setQ] = useState("");
  const [frota, setFrota] = useState("todas");
  const [local, setLocal] = useState("todos");
  const [soUrgentes, setSoUrgentes] = useState(false);
  const [soAtraso, setSoAtraso] = useState(false);
  const [ocultarFinalizados, setOcultarFinalizados] = useState(false);
  const [novo, setNovo] = useState(false);
  const [detalheId, setDetalheId] = useState<number | null>(null);
  const [seenIds, setSeenIds] = useState<Set<number>>(new Set());
  const [prefill, setPrefill] = useState<any | null>(null);

  // Restaura filtros salvos na 1a montagem
  useEffect(() => {
    const f = lerFiltros();
    if (f) {
      setQ(f.q ?? "");
      setFrota(f.frota ?? "todas");
      setLocal(f.local ?? "todos");
      setSoUrgentes(!!f.soUrgentes);
      setSoAtraso(!!f.soAtraso);
      setOcultarFinalizados(!!f.ocultarFinalizados);
    }
    // Pede permissão pra notificação (silencioso se recusar)
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Persiste sempre que muda
  useEffect(() => {
    salvarFiltros({
      q,
      frota,
      local,
      soUrgentes,
      soAtraso,
      ocultarFinalizados,
    });
  }, [q, frota, local, soUrgentes, soAtraso, ocultarFinalizados]);

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (frota !== "todas") params.set("frota", frota);
  if (local !== "todos") params.set("local", local);
  if (soUrgentes) params.set("urgente", "1");
  if (ocultarFinalizados) params.set("ocultarFinalizados", "1");

  const { data, isLoading, mutate } = useSWR<{
    pedidos: Pedido[];
    frotas: string[];
    locais: string[];
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
      // Notificação sonora + browser
      try {
        const audio = new Audio(
          "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAAcAAAADAAAJDABERERERERERERERERERERERERERERiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIu7u7u7u7u7u7u7u7u7u7u7u7u7u7u///////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAACSSSXqvzAAAAAAAAAAAAAAAAAAAAAP/7kGQAAANUMEoFPeACNQV40KEYABEY41g5vAAI9RjrCzeAAQAAAmwAAAAAM4x71NUS4Znxs+GKZeS7oHZ3jHKV1JcRJb47r3aXwILhTOhb7cSg5Gjp2VjMuXcMj3jSk8fXQ0GYJTNyYP5QHRUEEUFhkxyaCEZ2LRy1EJqoRuNZGgFAHzM9DBHfaQwqwCPCFmDeIQmY1RVdAB4dsBjPBu6PoBc5AA=="
        );
        audio.volume = 0.4;
        audio.play().catch(() => {});
      } catch {}
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const p = pedidos.find((x) => novosUrgentes.has(x.id));
          if (p) {
            new Notification("🔴 Pedido URGENTE", {
              body: `${p.frota} · ${p.descricao} (por ${p.solicitante})`,
              icon: "/favicon.svg",
              tag: `urgente-${p.id}`,
            });
          }
        }
      } catch {}
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
        local={local}
        locais={data?.locais ?? []}
        onLocal={setLocal}
        soUrgentes={soUrgentes}
        onSoUrgentes={setSoUrgentes}
        soAtraso={soAtraso}
        onSoAtraso={setSoAtraso}
        ocultarFinalizados={ocultarFinalizados}
        onOcultarFinalizados={setOcultarFinalizados}
        onNovoPedido={() => setNovo(true)}
      />
      <KPIBar />

      <div className="dense-scroll flex gap-2 overflow-x-auto pb-4">
        {COLUNAS.map((col) => (
          <KanbanColuna
            key={col.key}
            titulo={col.label}
            dot={col.dot}
            pedidos={porStatus.get(col.key) ?? []}
            destacarUrgentes={novosUrgentes}
            arrastavel={isAdmin}
            acaoLimpar={
              isAdmin && col.key === "cancelada"
                ? {
                    label: "Limpar",
                    titulo: "Apagar permanentemente todos os pedidos cancelados",
                    onClick: async () => {
                      const qtd = (porStatus.get("cancelada") ?? []).length;
                      const ok = window.confirm(
                        `Apagar permanentemente ${qtd} pedido(s) cancelado(s)?\n\nIsso NÃO pode ser desfeito.`
                      );
                      if (!ok) return;
                      const res = await fetch(
                        "/api/pedidos/limpar-cancelados",
                        { method: "POST" }
                      );
                      const j = await res.json().catch(() => ({}));
                      if (res.ok) {
                        mutate();
                      } else {
                        alert(j.error ?? "Falha ao limpar cancelados.");
                      }
                    },
                  }
                : undefined
            }
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
        <div
          className="card p-4 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          Carregando pedidos…
        </div>
      )}

      {novo && (
        <NovoPedidoDialog
          prefill={prefill ?? undefined}
          locaisConhecidos={data?.locais ?? []}
          onClose={() => {
            setNovo(false);
            setPrefill(null);
          }}
          onCreated={() => {
            setNovo(false);
            setPrefill(null);
            mutate();
          }}
        />
      )}
      {detalheId != null && (
        <PedidoDetalheDialog
          id={detalheId}
          onClose={() => setDetalheId(null)}
          onChanged={() => mutate()}
          onDuplicar={(dados) => {
            setDetalheId(null);
            setPrefill(dados);
            setNovo(true);
          }}
        />
      )}
    </div>
  );
}

