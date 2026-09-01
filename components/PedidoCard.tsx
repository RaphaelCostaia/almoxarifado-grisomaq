"use client";

import clsx from "clsx";
import type { Pedido } from "@/db/schema";
import { formatBR, diasDesde } from "@/lib/date";

type Props = {
  pedido: Pedido;
  destaque: boolean;
  arrastavel?: boolean;
  onAbrir: () => void;
};

export function PedidoCard({
  pedido,
  destaque,
  arrastavel = true,
  onAbrir,
}: Props) {
  const urgente = pedido.prioridade === "urgente";
  const dias = diasDesde(pedido.atualizadoEm);
  const atrasado =
    !["entregue", "cancelada"].includes(pedido.status) && dias >= 2;

  return (
    <button
      draggable={arrastavel}
      onDragStart={(e) => {
        if (!arrastavel) return;
        e.dataTransfer.setData("text/pedido-id", String(pedido.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onAbrir}
      className={clsx(
        "group relative block w-full overflow-hidden rounded-md border p-2.5 text-left transition",
        arrastavel && "cursor-grab active:cursor-grabbing",
        destaque && "animate-pulseUrgente"
      )}
      style={{
        background: urgente ? "var(--danger-soft)" : "var(--surface)",
        borderColor: urgente ? "var(--danger-border)" : "var(--border)",
      }}
    >
      {/* Barra lateral esquerda */}
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{
          background: urgente ? "var(--danger)" : "var(--brand)",
        }}
      />
      <div className="pl-1.5">
        {urgente && (
          <div className="mb-1.5 flex items-center gap-1">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--danger)" }}
            />
            <span
              className="font-mono text-[9px] font-black uppercase tracking-widest"
              style={{ color: "var(--danger)" }}
            >
              URGENTE
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip">{pedido.frota}</span>
          {pedido.local && (
            <span className="chip chip-info">📍 {pedido.local}</span>
          )}
          {pedido.quantidade > 1 && (
            <span
              className="font-mono text-[10px] font-bold tabular-nums"
              style={{ color: "var(--text-muted)" }}
            >
              ×{pedido.quantidade} {pedido.unidade}
            </span>
          )}
        </div>
        <div
          className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug"
          style={{ color: "var(--text)" }}
        >
          {pedido.descricao}
        </div>
        <div
          className="mt-1.5 flex items-center justify-between text-[10px]"
          style={{ color: "var(--text-muted)" }}
        >
          <span className="truncate">{pedido.solicitante}</span>
          <span className="font-mono tabular-nums">
            {formatBR(pedido.criadoEm)}
          </span>
        </div>
        {atrasado && (
          <div
            className="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest"
            style={{
              background: "var(--warning-soft)",
              color: "var(--warning)",
            }}
          >
            ◷ {dias}d parado
          </div>
        )}
      </div>
    </button>
  );
}
