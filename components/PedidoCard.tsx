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

export function PedidoCard({ pedido, destaque, arrastavel = true, onAbrir }: Props) {
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
        "group w-full rounded-md border-l-4 bg-creme-50 p-2.5 text-left shadow-sm transition hover:shadow-md",
        arrastavel && "cursor-grab active:cursor-grabbing",
        urgente
          ? "border-l-red-600 bg-red-50 ring-1 ring-red-200"
          : "border-l-oliva-500 ring-1 ring-oliva-100",
        destaque && "animate-pulseUrgente"
      )}
    >
      {urgente && (
        <div className="mb-1 flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
          🔴 URGENTE
        </div>
      )}
      <div className="chip mb-1">{pedido.frota}</div>
      <div className="mb-1 line-clamp-2 text-sm font-semibold leading-snug text-oliva-900">
        {pedido.quantidade > 1 && (
          <span className="mr-1 font-mono text-oliva-700">
            {pedido.quantidade} {pedido.unidade} ·
          </span>
        )}
        {pedido.descricao}
      </div>
      <div className="flex items-center justify-between text-[11px] text-oliva-700">
        <span>{pedido.solicitante}</span>
        <span className="font-mono">{formatBR(pedido.criadoEm)}</span>
      </div>
      {atrasado && (
        <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
          ⏱ {dias}d parado
        </div>
      )}
    </button>
  );
}
