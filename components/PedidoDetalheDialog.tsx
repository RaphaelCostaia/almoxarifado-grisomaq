"use client";

import { useState } from "react";
import useSWR from "swr";
import clsx from "clsx";
import Link from "next/link";
import {
  STATUS_PEDIDO_LABELS,
  STATUS_PEDIDO_ORDEM,
  STATUS_COMPRA_LABELS,
  type Pedido,
  type PedidoEvento,
  type Peca,
  type Compra,
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
  onDuplicar?: (dados: {
    frota: string;
    local?: string;
    modeloVeiculo?: string;
    anoVeiculo?: string;
    codigoPeca?: string;
    fabricante?: string;
    descricao: string;
    quantidade: number;
    unidade: string;
    motivo: string;
    prioridade: "normal" | "urgente";
    observacoes: string;
    pecaId: number | null;
  }) => void;
};

// Cor do badge de status (independente da urgência)
function statusStyle(status: Pedido["status"]): React.CSSProperties {
  const map: Record<Pedido["status"], React.CSSProperties> = {
    solicitada: { background: "var(--info-soft)", color: "var(--info)" },
    providenciando: {
      background: "var(--warning-soft)",
      color: "var(--warning)",
    },
    aguardando_buscar: {
      background: "rgba(168,85,247,0.15)",
      color: "#c084fc",
    },
    aguardando_retirada: {
      background: "rgba(6,182,212,0.15)",
      color: "#22d3ee",
    },
    entregue: { background: "var(--brand-soft)", color: "var(--brand)" },
    cancelada: { background: "var(--danger-soft)", color: "var(--danger)" },
  };
  return map[status];
}

export function PedidoDetalheDialog({
  id,
  onClose,
  onChanged,
  onDuplicar,
}: Props) {
  const { nome } = useCurrentUserName();
  const isAdmin = useIsAdmin();
  const { data, mutate } = useSWR<{
    pedido: Pedido;
    eventos: PedidoEvento[];
    peca: Peca | null;
    compras: Compra[];
  }>(`/api/pedidos/${id}`, fetcher, { refreshInterval: 3000 });
  const [comentario, setComentario] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState<null | "cancelar" | "reabrir" | "excluir">(
    null
  );

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
        <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>
          Carregando…
        </div>
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

  return (
    <Modal onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className="rounded-md px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest"
          style={statusStyle(pedido.status)}
        >
          {STATUS_PEDIDO_LABELS[pedido.status]}
        </span>
        {pedido.prioridade === "urgente" && (
          <span
            className="rounded-md px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest"
            style={{ background: "var(--danger)", color: "#fff" }}
          >
            🔴 Urgente
          </span>
        )}
      </div>

      <h2
        className="mb-3 text-lg font-bold tracking-tight"
        style={{ color: "var(--text)" }}
      >
        {pedido.quantidade > 1 && (
          <span
            className="mr-1 font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            {pedido.quantidade} {pedido.unidade} ·
          </span>
        )}
        {pedido.descricao}
      </h2>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Frota / Equipamento" v={pedido.frota} />
        <Field label="Local de trabalho" v={pedido.local ?? "—"} />
        <Field label="Modelo do veículo" v={pedido.modeloVeiculo ?? "—"} />
        <Field label="Ano" v={pedido.anoVeiculo ?? "—"} />
        <Field label="Código da peça" v={pedido.codigoPeca ?? "—"} mono />
        <Field label="Fabricante" v={pedido.fabricante ?? "—"} />
        <Field label="Solicitante" v={pedido.solicitante} />
        <Field label="Motivo" v={pedido.motivo} />
        <Field label="Solicitado em" v={formatBR(pedido.criadoEm)} />
        <Field
          label="Última atualização"
          v={`${formatBR(pedido.atualizadoEm)} · ${diasDesde(
            pedido.atualizadoEm
          )}d`}
        />
      </div>

      {peca && (
        <div
          className="mt-3 rounded-md border p-3 text-sm"
          style={{
            background: "var(--surface-3)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Peça vinculada ao estoque
          </div>
          <div className="mt-1 flex items-center justify-between">
            <div>
              <div
                className="font-semibold"
                style={{ color: "var(--text)" }}
              >
                {peca.nome}
              </div>
              {peca.codigo && (
                <div
                  className="font-mono text-[10px] uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}
                >
                  {peca.codigo}
                </div>
              )}
            </div>
            <span
              className={clsx(
                "chip",
                peca.saldo === 0
                  ? "chip-danger"
                  : peca.saldo <= peca.minimo
                  ? "chip-warning"
                  : "chip-brand"
              )}
            >
              Saldo {peca.saldo} {peca.unidade}
            </span>
          </div>
          {isAdmin && (peca.saldo === 0 || peca.saldo < pedido.quantidade) && (
            <div
              className="mt-2 rounded-md p-2 text-xs"
              style={{
                background: "var(--warning-soft)",
                color: "var(--warning)",
              }}
            >
              Estoque insuficiente.{" "}
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

      {!peca && isAdmin && (
        <div
          className="mt-3 rounded-md p-2 text-xs"
          style={{
            background: "var(--warning-soft)",
            color: "var(--warning)",
          }}
        >
          ⚠ Este pedido não está vinculado a uma peça do estoque — a baixa
          automática não vai acontecer ao entregar. Considere cadastrar a peça
          no estoque.
        </div>
      )}

      {(data.compras ?? []).length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Compras vinculadas
          </div>
          {(data.compras ?? []).map((cp) => (
            <Link
              key={cp.id}
              href={`/compras/${cp.id}`}
              className="flex items-center gap-2 rounded-md border p-2 text-sm transition hover:opacity-90"
              style={{
                background: "var(--surface-3)",
                borderColor: "var(--border)",
              }}
            >
              <span
                className={clsx(
                  "chip",
                  cp.status === "recebida"
                    ? "chip-brand"
                    : cp.status === "cancelada"
                    ? "chip-danger"
                    : cp.status === "comprada"
                    ? "chip-warning"
                    : "chip-info"
                )}
              >
                {STATUS_COMPRA_LABELS[cp.status]}
              </span>
              <span
                className="flex-1 truncate"
                style={{ color: "var(--text)" }}
              >
                #{cp.id} · {cp.descricao}
              </span>
              {cp.fornecedor && (
                <span
                  className="truncate text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {cp.fornecedor}
                </span>
              )}
              {cp.valorTotal && (
                <span
                  className="font-mono text-xs font-bold"
                  style={{ color: "var(--brand)" }}
                >
                  R$ {cp.valorTotal}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {pedido.observacoes && (
        <div
          className="mt-3 rounded-md p-3 text-sm"
          style={{ background: "var(--surface-3)", color: "var(--text)" }}
        >
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Observações
          </div>
          <div>{pedido.observacoes}</div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {onDuplicar && (
          <button
            className="btn-secondary"
            onClick={() =>
              onDuplicar({
                frota: pedido.frota,
                local: pedido.local ?? undefined,
                modeloVeiculo: pedido.modeloVeiculo ?? undefined,
                anoVeiculo: pedido.anoVeiculo ?? undefined,
                codigoPeca: pedido.codigoPeca ?? undefined,
                fabricante: pedido.fabricante ?? undefined,
                descricao: pedido.descricao,
                quantidade: pedido.quantidade,
                unidade: pedido.unidade,
                motivo: pedido.motivo,
                prioridade: pedido.prioridade,
                observacoes: pedido.observacoes ?? "",
                pecaId: pedido.pecaId ?? null,
              })
            }
          >
            ⎘ Duplicar pedido
          </button>
        )}
      </div>
      {isAdmin && (
        <div className="mt-2 flex flex-wrap gap-2">
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
              className="btn-danger ml-auto"
              disabled={salvando}
              onClick={() => setConfirmando("cancelar")}
            >
              Cancelar pedido
            </button>
          )}
          {finalizado && (
            <button
              className="btn-primary"
              disabled={salvando}
              onClick={() => setConfirmando("reabrir")}
            >
              ↺ Reabrir pedido
            </button>
          )}
          <button
            className="btn-ghost !text-[11px]"
            style={{ color: "var(--text-dim)" }}
            disabled={salvando}
            onClick={() => setConfirmando("excluir")}
            title="Apaga definitivamente — use quando criou por engano"
          >
            🗑 Excluir permanentemente
          </button>
        </div>
      )}
      {!isAdmin && !finalizado && (
        <div
          className="mt-4 rounded-md p-2 text-xs"
          style={{
            background: "var(--surface-3)",
            color: "var(--text-muted)",
          }}
        >
          Apenas o administrador do almoxarifado pode avançar ou cancelar o
          pedido. Você pode adicionar observações abaixo.
        </div>
      )}

      <div
        className="my-4 h-px"
        style={{ background: "var(--border)" }}
      />

      <div>
        <div
          className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Histórico
        </div>
        <ul className="space-y-1 text-sm">
          {eventos.map((ev) => (
            <li key={ev.id} className="flex items-start gap-2">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--brand)" }}
              />
              <div>
                <span style={{ color: "var(--text)" }}>{ev.texto}</span>
                <span
                  className="ml-1 font-mono text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
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

      {confirmando && confirmando !== "excluir" && (
        <ConfirmDialog
          titulo={
            confirmando === "cancelar"
              ? "Cancelar este pedido?"
              : "Reabrir este pedido?"
          }
          descricao={
            confirmando === "cancelar"
              ? "O cartão vai pra coluna Cancelado. Você pode reabrir depois se precisar."
              : "O pedido volta pra coluna Solicitada."
          }
          confirmar={confirmando === "cancelar" ? "Sim, cancelar" : "Sim, reabrir"}
          tone={confirmando === "cancelar" ? "danger" : "brand"}
          onClose={() => setConfirmando(null)}
          onConfirm={async () => {
            const acao = confirmando;
            setConfirmando(null);
            await patch({
              status: acao === "cancelar" ? "cancelada" : "solicitada",
            });
          }}
        />
      )}
      {confirmando === "excluir" && (
        <ConfirmDialog
          titulo="Excluir este pedido PERMANENTEMENTE?"
          descricao="Isso apaga o pedido e o histórico. NÃO recuperável. Use apenas quando criou por engano — pra registrar que não vai ser atendido, prefira Cancelar."
          confirmar="Sim, excluir definitivo"
          tone="danger"
          onClose={() => setConfirmando(null)}
          onConfirm={async () => {
            setConfirmando(null);
            setSalvando(true);
            const res = await fetch(`/api/pedidos/${id}`, { method: "DELETE" });
            setSalvando(false);
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              alert(j.mensagem ?? "Falha ao excluir.");
              return;
            }
            onChanged();
            onClose();
          }}
        />
      )}
    </Modal>
  );
}

function Field({
  label,
  v,
  mono,
}: {
  label: string;
  v: string;
  mono?: boolean;
}) {
  return (
    <div
      className="rounded-md border p-2.5"
      style={{
        background: "var(--surface-3)",
        borderColor: "var(--border)",
      }}
    >
      <div
        className="font-mono text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className={`mt-0.5 text-sm font-medium ${mono ? "font-mono" : ""}`}
        style={{ color: "var(--text)" }}
      >
        {v}
      </div>
    </div>
  );
}

function diasDesde(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24));
}

export function ConfirmDialog({
  titulo,
  descricao,
  confirmar,
  tone,
  onClose,
  onConfirm,
}: {
  titulo: string;
  descricao: string;
  confirmar: string;
  tone: "danger" | "brand";
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md p-5"
        style={{ boxShadow: "var(--shadow-md)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold tracking-tight">{titulo}</h3>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          {descricao}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Voltar
          </button>
          <button
            className={tone === "danger" ? "btn-danger" : "btn-primary"}
            onClick={onConfirm}
          >
            {confirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
