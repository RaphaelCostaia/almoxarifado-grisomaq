"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Pedido } from "@/db/schema";
import { PedidoCard } from "./PedidoCard";

type Props = {
  titulo: string;
  dot: string;
  pedidos: Pedido[];
  destacarUrgentes: Set<number>;
  arrastavel: boolean;
  onAbrir: (id: number) => void;
  onDrop?: (pedidoId: number) => Promise<void> | void;
};

export function KanbanColuna({
  titulo,
  dot,
  pedidos,
  destacarUrgentes,
  arrastavel,
  onAbrir,
  onDrop,
}: Props) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={clsx(
        "flex min-h-[420px] w-[240px] shrink-0 flex-col overflow-hidden rounded-lg border transition"
      )}
      style={{
        background: over ? "var(--brand-soft)" : "var(--surface-2)",
        borderColor: over ? "var(--brand-border)" : "var(--border)",
      }}
      onDragOver={(e) => {
        if (!onDrop) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!onDrop) return;
        e.preventDefault();
        setOver(false);
        const id = Number(e.dataTransfer.getData("text/pedido-id"));
        if (Number.isFinite(id)) onDrop(id);
      }}
    >
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <span className={clsx("h-2 w-2 rounded-full", dot)} />
          <span
            className="font-mono text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            {titulo}
          </span>
        </div>
        <span
          className="font-mono text-[11px] font-bold tabular-nums"
          style={{ color: "var(--text)" }}
        >
          {pedidos.length}
        </span>
      </div>
      <div className="dense-scroll flex-1 space-y-1.5 overflow-y-auto p-1.5">
        {pedidos.length === 0 ? (
          <div
            className="mt-6 text-center font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--text-dim)" }}
          >
            —
          </div>
        ) : (
          pedidos.map((p) => (
            <PedidoCard
              key={p.id}
              pedido={p}
              destaque={destacarUrgentes.has(p.id)}
              arrastavel={arrastavel}
              onAbrir={() => onAbrir(p.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
