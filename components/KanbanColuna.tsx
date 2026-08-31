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
        "flex min-h-[420px] w-72 shrink-0 flex-col rounded-lg border bg-creme-50 shadow-sm transition",
        over ? "border-oliva-500 bg-oliva-50" : "border-oliva-100"
      )}
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
      <div className="flex items-center justify-between border-b border-oliva-100 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-bold text-oliva-900">
          <span className={clsx("h-2 w-2 rounded-full", dot)} />
          {titulo}
        </div>
        <span className="rounded-md bg-white px-2 py-0.5 font-mono text-xs text-oliva-700">
          {pedidos.length}
        </span>
      </div>
      <div className="flex-1 space-y-2 p-2">
        {pedidos.length === 0 ? (
          <div className="mt-4 text-center text-sm text-oliva-500/70">
            Nada por aqui
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
