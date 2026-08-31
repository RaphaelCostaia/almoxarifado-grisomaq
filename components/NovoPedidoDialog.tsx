"use client";

import { useState } from "react";
import { MOTIVOS_PEDIDO, type Peca } from "@/db/schema";
import { PecaAutocomplete } from "./PecaAutocomplete";
import { useCurrentUserName } from "@/lib/user";
import { useSession } from "./SessionProvider";
import clsx from "clsx";

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

export function NovoPedidoDialog({ onClose, onCreated }: Props) {
  const { nome } = useSession();
  const [frota, setFrota] = useState("");
  const [descricao, setDescricao] = useState("");
  const [peca, setPeca] = useState<Peca | null>(null);
  const [qtd, setQtd] = useState<number>(1);
  const [unidade, setUnidade] = useState("un");
  const [motivo, setMotivo] = useState<(typeof MOTIVOS_PEDIDO)[number]>(
    MOTIVOS_PEDIDO[0]
  );
  const [prioridade, setPrioridade] = useState<"normal" | "urgente">("normal");
  const [observacoes, setObservacoes] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      let fotoUrl: string | null = null;
      if (foto) {
        const fd = new FormData();
        fd.append("file", foto);
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        if (up.ok) {
          const j = await up.json();
          fotoUrl = j.url;
        }
      }
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frota,
          descricao: peca ? peca.nome : descricao,
          quantidade: qtd,
          unidade: peca ? peca.unidade : unidade,
          motivo,
          prioridade,
          observacoes: observacoes || null,
          fotoUrl,
          pecaId: peca?.id ?? null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao registrar pedido");
      }
      onCreated();
    } catch (err: any) {
      setErro(err.message ?? "Erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal onClose={onClose} tituloBadge="Novo pedido de peça">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label-form">Frota / Frente / Equipamento</label>
          <input
            className="input-base"
            required
            placeholder="Ex: Frota 95, Frente 103, Trator 5508"
            value={frota}
            onChange={(e) => setFrota(e.target.value)}
          />
        </div>
        <div>
          <label className="label-form">Peça / Descrição</label>
          <PecaAutocomplete
            valor={descricao}
            onValor={setDescricao}
            onPeca={setPeca}
          />
          {peca && (
            <div className="mt-1 text-xs text-oliva-700">
              Vinculado ao estoque:{" "}
              <span className="font-semibold">{peca.nome}</span> · saldo atual{" "}
              <span
                className={clsx(
                  "font-mono",
                  peca.saldo === 0
                    ? "text-red-600"
                    : peca.saldo <= peca.minimo
                    ? "text-amber-700"
                    : "text-oliva-700"
                )}
              >
                {peca.saldo} {peca.unidade}
              </span>
              . Ao ser entregue o saldo baixa automaticamente.
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-form">Quantidade</label>
            <input
              type="number"
              min={1}
              className="input-base"
              value={qtd}
              onChange={(e) => setQtd(Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className="label-form">Unidade</label>
            <input
              className="input-base"
              placeholder="un, m, L…"
              value={peca ? peca.unidade : unidade}
              onChange={(e) => setUnidade(e.target.value)}
              disabled={!!peca}
            />
          </div>
        </div>
        <div>
          <label className="label-form">Motivo</label>
          <select
            className="input-base"
            value={motivo}
            onChange={(e) =>
              setMotivo(e.target.value as (typeof MOTIVOS_PEDIDO)[number])
            }
          >
            {MOTIVOS_PEDIDO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-form">Solicitante</label>
          <input
            className="input-base bg-white"
            value={nome}
            disabled
          />
          <p className="mt-1 text-[11px] opacity-70">
            Registrado como você está logado. Para trocar, saia e entre com
            outro usuário.
          </p>
        </div>
        <div>
          <label className="label-form">Prioridade</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPrioridade("normal")}
              className={clsx(
                "rounded-md border px-3 py-2 text-sm font-semibold",
                prioridade === "normal"
                  ? "border-oliva-600 bg-oliva-600 text-white"
                  : "border-oliva-100 bg-white text-oliva-800 hover:bg-oliva-50"
              )}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => setPrioridade("urgente")}
              className={clsx(
                "rounded-md border px-3 py-2 text-sm font-semibold",
                prioridade === "urgente"
                  ? "border-red-600 bg-red-600 text-white"
                  : "border-oliva-100 bg-white text-oliva-800 hover:bg-red-50"
              )}
            >
              🔴 Urgente
            </button>
          </div>
        </div>
        <div>
          <label className="label-form">
            Foto da peça (opcional, ajuda muito)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            className="text-sm text-oliva-800"
          />
        </div>
        <div>
          <label className="label-form">Observações (opcional)</label>
          <textarea
            rows={3}
            className="input-base"
            placeholder="Detalhes técnicos, especificação, etc."
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>
        {erro && (
          <div className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {erro}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={salvando}>
            {salvando ? "Registrando…" : "Registrar pedido"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Modal({
  children,
  onClose,
  tituloBadge,
  badgeTone,
}: {
  children: React.ReactNode;
  onClose: () => void;
  tituloBadge?: string;
  badgeTone?: "verde" | "vermelho" | "cinza" | "amarelo";
}) {
  const toneCls =
    badgeTone === "vermelho"
      ? "bg-red-600 text-white"
      : badgeTone === "cinza"
      ? "bg-neutral-500 text-white"
      : badgeTone === "amarelo"
      ? "bg-amber-500 text-white"
      : "bg-oliva-800 text-white";
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-oliva-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mt-8 w-full max-w-xl rounded-xl border border-oliva-100 bg-creme-50 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          {tituloBadge ? (
            <span
              className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-widest ${toneCls}`}
            >
              {tituloBadge}
            </span>
          ) : (
            <div />
          )}
          <button
            className="rounded-md p-1 text-oliva-800 hover:bg-oliva-50"
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
