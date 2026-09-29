"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import type { ManutencaoOrdem, Peca } from "@/db/schema";
import { toNum } from "@/lib/formatSaldo";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ManutencaoConcluirDialog({
  id,
  onClose,
  onDone,
}: {
  id: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data } = useSWR<{ ordens: ManutencaoOrdem[] }>(
    `/api/admin/manutencao/ordens`,
    fetcher
  );
  const ordem = data?.ordens.find((o) => o.id === id) ?? null;

  // Se peça vinculada, busca saldo atual pra alertar se falta estoque
  const { data: estoque } = useSWR<{ pecas: Peca[] }>(
    ordem?.pecaCodigo
      ? `/api/estoque?q=${encodeURIComponent(ordem.pecaCodigo)}&limit=5`
      : null,
    fetcher
  );
  const peca =
    ordem && estoque
      ? estoque.pecas.find(
          (p) =>
            (ordem.pecaId && p.id === ordem.pecaId) ||
            (p.codigo && p.codigo === ordem.pecaCodigo)
        )
      : null;

  const [hodometro, setHodometro] = useState("");
  const [quantidade, setQuantidade] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (ordem) {
      setQuantidade(String(ordem.quantidade));
      setObservacoes(ordem.observacoes ?? "");
    }
  }, [ordem?.id]);

  if (!ordem) return null;

  const saldoAtual = peca ? toNum(peca.saldo) : null;
  const qtdNum = Number(quantidade.replace(",", ".")) || 0;
  const saldoInsuficiente =
    saldoAtual != null && ordem.pecaId != null && qtdNum > saldoAtual;

  async function salvar() {
    setErro(null);
    if (!hodometro.trim()) {
      setErro("Informe o hodômetro atual.");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch(`/api/admin/manutencao/ordens/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "concluida",
          hodometroConcluido: hodometro.trim(),
          quantidade: qtdNum || undefined,
          observacoes: observacoes.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErro(j.mensagem ?? j.error ?? "Falha ao concluir");
        return;
      }
      onDone();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto p-4 backdrop-blur-sm"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md p-5"
        style={{ boxShadow: "var(--shadow-md)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3">
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Concluir OS #{id}
          </div>
          <div className="text-lg font-bold">
            Frota {ordem.frotaNumero} — {ordem.compartimentoTipo}
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {ordem.pecaCodigo && <span className="font-mono">{ordem.pecaCodigo} · </span>}
            {ordem.pecaDescricao ?? "(sem peça vinculada)"}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label-form">Hodômetro atual (obrigatório)</label>
            <input
              className="input-base font-mono"
              value={hodometro}
              onChange={(e) => setHodometro(e.target.value)}
              placeholder="Ex: 429.899"
              autoFocus
            />
          </div>
          <div>
            <label className="label-form">
              Quantidade consumida ({ordem.unidade})
            </label>
            <input
              className="input-base font-mono"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              inputMode="decimal"
            />
            {ordem.pecaId && peca && (
              <div
                className="mt-1 text-[11px]"
                style={{
                  color: saldoInsuficiente
                    ? "var(--danger)"
                    : "var(--text-muted)",
                }}
              >
                {saldoInsuficiente ? "⚠ " : ""}
                Saldo em estoque: {saldoAtual} {peca.unidade}
                {saldoInsuficiente &&
                  " — vai zerar/negativar. Continuar assim mesmo?"}
              </div>
            )}
            {!ordem.pecaId && (
              <div
                className="mt-1 text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                Peça não vinculada ao estoque — não vai dar baixa automática.
              </div>
            )}
          </div>
          <div>
            <label className="label-form">Observações</label>
            <textarea
              rows={2}
              className="input-base"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          {erro && (
            <div
              className="rounded-md border p-2 text-xs"
              style={{
                borderColor: "var(--danger-border)",
                background: "var(--danger-soft)",
                color: "var(--danger)",
              }}
            >
              {erro}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              className="btn-secondary"
              onClick={onClose}
              disabled={salvando}
            >
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={salvar}
              disabled={salvando}
            >
              {salvando ? "Concluindo…" : "✓ Concluir e dar baixa"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
