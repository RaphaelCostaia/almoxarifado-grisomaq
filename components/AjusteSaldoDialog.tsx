"use client";

import { useState } from "react";
import useSWR from "swr";
import { Modal } from "./NovoPedidoDialog";
import { useCurrentUserName } from "@/lib/user";
import type { Peca, Movimentacao } from "@/db/schema";
import { formatBR } from "@/lib/date";
import { formatSaldo } from "@/lib/formatSaldo";
import clsx from "clsx";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function AjusteSaldoDialog({
  pecaId,
  onClose,
  onSaved,
}: {
  pecaId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { nome } = useCurrentUserName();
  const [tipo, setTipo] = useState<"entrada" | "saida" | "ajuste">("entrada");
  const [qtd, setQtd] = useState(1);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: estoque } = useSWR<{ pecas: Peca[] }>(
    `/api/estoque`,
    fetcher
  );
  const peca = estoque?.pecas.find((p) => p.id === pecaId);

  const { data: mov, mutate: refetchMov } = useSWR<{
    movimentacoes: Movimentacao[];
  }>(`/api/estoque/${pecaId}/movimentacoes`, fetcher);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    await fetch(`/api/estoque/${pecaId}/ajuste`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, quantidade: qtd, motivo }),
    });
    setSalvando(false);
    setQtd(1);
    setMotivo("");
    await refetchMov();
    onSaved();
  }

  return (
    <Modal onClose={onClose} tituloBadge="Ajustar saldo">
      {peca && (
        <div className="mb-3">
          <div className="text-sm text-oliva-700">{peca.codigo}</div>
          <div className="text-lg font-black text-oliva-900">{peca.nome}</div>
          <div className="mt-1 text-sm">
            Saldo atual:{" "}
            <span className="font-mono font-bold">
              {formatSaldo(peca.saldo, peca.unidade)} {peca.unidade}
            </span>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {(["entrada", "saida", "ajuste"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={clsx(
                "rounded-md border px-3 py-2 text-sm font-semibold capitalize",
                tipo === t
                  ? "border-oliva-600 bg-oliva-600 text-white"
                  : "border-oliva-100 bg-white text-oliva-800 hover:bg-oliva-50"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div>
          <label className="label-form">
            {tipo === "ajuste" ? "Novo saldo total" : "Quantidade"}
          </label>
          <input
            type="number"
            min={0}
            step={0.001}
            className="input-base"
            value={qtd}
            onChange={(e) => setQtd(Number(e.target.value))}
            required
          />
        </div>
        <div>
          <label className="label-form">Motivo</label>
          <input
            className="input-base"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: Compra Fornecedor X / inventário"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" type="button" onClick={onClose}>
            Fechar
          </button>
          <button className="btn-primary" disabled={salvando}>
            {salvando ? "Salvando…" : "Registrar"}
          </button>
        </div>
      </form>

      <hr className="my-4 border-oliva-100" />
      <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-oliva-800">
        Últimas movimentações
      </div>
      <ul className="max-h-56 space-y-1 overflow-auto text-sm">
        {(mov?.movimentacoes ?? []).map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded-md bg-white px-2 py-1"
          >
            <div>
              <span
                className={clsx(
                  "chip",
                  m.tipo === "entrada"
                    ? "!bg-emerald-100 !text-emerald-800"
                    : m.tipo === "saida"
                    ? "!bg-red-100 !text-red-700"
                    : "!bg-amber-100 !text-amber-800"
                )}
              >
                {m.tipo}
              </span>
              <span className="ml-2 font-mono">
                {m.tipo === "ajuste" ? "=" : m.tipo === "entrada" ? "+" : "-"}
                {m.quantidade}
              </span>
              {m.motivo && (
                <span className="ml-2 text-oliva-700">— {m.motivo}</span>
              )}
            </div>
            <span className="font-mono text-[11px] text-oliva-600">
              {m.autor} · {formatBR(m.criadoEm)}
            </span>
          </li>
        ))}
        {(!mov || mov.movimentacoes.length === 0) && (
          <li className="py-2 text-center text-oliva-500">Sem movimentações.</li>
        )}
      </ul>
    </Modal>
  );
}
