"use client";

import { useState } from "react";
import useSWR from "swr";
import clsx from "clsx";
import Link from "next/link";
import {
  STATUS_PEDIDO_LABELS,
  STATUS_PEDIDO_ORDEM,
  type Pedido,
  type PedidoEvento,
  type Peca,
} from "@/db/schema";
import { formatBR } from "@/lib/date";
import { useCurrentUserName } from "@/lib/user";
import { useIsAdmin } from "./SessionProvider";
import { Modal } from "./NovoPedidoDialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Props = {
  id: number;
  onClose: () => void;
  onChanged: () => void;
};

export function PedidoDetalheDialog({ id, onClose, onChanged }: Props) {
  const { nome } = useCurrentUserName();
  const isAdmin = useIsAdmin();
  const { data, mutate } = useSWR<{
    pedido: Pedido;
    eventos: PedidoEvento[];
    peca: Peca | null;
  }>(`/api/pedidos/${id}`, fetcher, { refreshInterval: 3000 });
  const [comentario, setComentario] = useState("");
  const [salvando, setSalvando] = useState(false);

  const pedido = data?.pedido;
  const eventos = data?.eventos ?? [];
  const peca = data?.peca ?? null;
  const finalizado = pedido
    ? ["entregue", "cancelada"].includes(pedido.status)
    : false;

  async function patch(update: any) {
    setSalvando(true);
    try {
      await fetch(`/api/pedidos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      await mutate();
      onChanged();
    } finally {
      setSalvando(false);
    }
  }

  async function adicionarComentario() {
    if (!comentario.trim()) return;
    setSalvando(true);
    await fetch(`/api/pedidos/${id}/evento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: comentario.trim() }),
    });
    setComentario("");
    await mutate();
    setSalvando(false);
  }

  if (!pedido) {
    return (
      <Modal onClose={onClose}>
        <div className="p-4 text-sm text-oliva-700">Carregando…</div>
      </Modal>
    );
  }

  const statusIdx = STATUS_PEDIDO_ORDEM.indexOf(pedido.status);
  const podeAvancar =
    pedido.status !== "entregue" && pedido.status !== "cancelada";
  const proximoStatus =
    podeAvancar && statusIdx >= 0 && statusIdx < 4
      ? STATUS_PEDIDO_ORDEM[statusIdx + 1]
      : null;

  const badgeTone =
    pedido.status === "cancelada"
      ? "cinza"
      : pedido.status === "entregue"
      ? "verde"
      : pedido.prioridade === "urgente"
      ? "vermelho"
      : undefined;

  return (
    <Modal
      onClose={onClose}
      tituloBadge={STATUS_PEDIDO_LABELS[pedido.status].toUpperCase()}
      badgeTone={badgeTone as any}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="text-lg font-black text-oliva-900">
          {pedido.quantidade > 1 && (
            <span className="mr-1 font-mono text-oliva-700">
              {pedido.quantidade} {pedido.unidade} ·
            </span>
          )}
          {pedido.descricao}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Frota / Frente" v={pedido.frota} />
        <Field label="Solicitante" v={pedido.solicitante} />
        <Field label="Solicitado em" v={formatBR(pedido.criadoEm)} />
        <Field
          label="Última atualização"
          v={`${formatBR(pedido.atualizadoEm)} · ${diasDesde(
            pedido.atualizadoEm
          )}d`}
        />
        <Field label="Motivo" v={pedido.motivo} />
        <Field
          label="Prioridade"
          v={pedido.prioridade === "urgente" ? "🔴 Urgente" : "Normal"}
        />
      </div>

      {peca && (
        <div className="mt-3 rounded-md border border-oliva-100 bg-white p-3 text-sm">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-oliva-700">
            Peça vinculada ao estoque
          </div>
          <div className="mt-1 flex items-center justify-between">
            <div>
              <div className="font-semibold text-oliva-900">{peca.nome}</div>
              {peca.codigo && (
                <div className="font-mono text-[11px] text-oliva-600">
                  {peca.codigo}
                </div>
              )}
            </div>
            <span
              className={clsx(
                "chip",
                peca.saldo === 0
                  ? "!bg-red-100 !text-red-700"
                  : peca.saldo <= peca.minimo
                  ? "!bg-amber-100 !text-amber-800"
                  : ""
              )}
            >
              Saldo {peca.saldo} {peca.unidade}
            </span>
          </div>
          {(peca.saldo === 0 || peca.saldo < pedido.quantidade) && (
            <div className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
              Estoque insuficiente para esta quantidade.{" "}
              <Link
                href={{
                  pathname: "/compras/nova",
                  query: {
                    pedido: pedido.id,
                    peca: peca.id,
                    qtd: pedido.quantidade,
                  },
                }}
                className="font-semibold underline"
              >
                Solicitar compra →
              </Link>
            </div>
          )}
        </div>
      )}

      {pedido.observacoes && (
        <div className="mt-3 rounded-md bg-creme-100 p-3 text-sm text-oliva-800">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-oliva-700">
            Observações
          </div>
          <div>{pedido.observacoes}</div>
        </div>
      )}

      {isAdmin && (
        <div className="mt-4 flex flex-wrap gap-2">
          {proximoStatus && (
            <button
              className="btn-primary"
              disabled={salvando}
              onClick={() => patch({ status: proximoStatus })}
            >
              Avançar → {STATUS_PEDIDO_LABELS[proximoStatus]}
            </button>
          )}
          {pedido.status !== "cancelada" && pedido.status !== "entregue" && (
            <button
              className="btn-secondary"
              disabled={salvando}
              onClick={() =>
                patch({
                  prioridade:
                    pedido.prioridade === "urgente" ? "normal" : "urgente",
                })
              }
            >
              {pedido.prioridade === "urgente"
                ? "Remover urgência"
                : "Marcar urgente"}
            </button>
          )}
          {!finalizado && (
            <button
              className="ml-auto rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              disabled={salvando}
              onClick={() => patch({ status: "cancelada" })}
            >
              Cancelar pedido
            </button>
          )}
          {finalizado && (
            <button
              className="btn-primary"
              disabled={salvando}
              onClick={() => patch({ status: "solicitada" })}
            >
              ↺ Reabrir pedido
            </button>
          )}
        </div>
      )}
      {!isAdmin && !finalizado && (
        <div className="mt-4 rounded-md bg-creme-100 p-2 text-xs opacity-80" style={{ background: "var(--surface)" }}>
          Apenas o administrador do almoxarifado pode avançar ou cancelar o
          pedido. Você pode adicionar observações abaixo.
        </div>
      )}

      <hr className="my-4 border-oliva-100" />

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-oliva-800">
          Histórico
        </div>
        <ul className="space-y-1 text-sm">
          {eventos.map((ev) => (
            <li key={ev.id} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-oliva-500" />
              <div>
                <span className="text-oliva-900">{ev.texto}</span>
                <span className="ml-1 font-mono text-[11px] text-oliva-600">
                  — {ev.autor}, {formatBR(ev.criadoEm)}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            className="input-base"
            placeholder="Adicionar observação…"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionarComentario();
              }
            }}
          />
          <button
            className="btn-primary"
            disabled={salvando || !comentario.trim()}
            onClick={adicionarComentario}
          >
            Adicionar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-md bg-white p-2">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-oliva-700">
        {label}
      </div>
      <div className="text-sm font-medium text-oliva-900">{v}</div>
    </div>
  );
}

function diasDesde(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24));
}
