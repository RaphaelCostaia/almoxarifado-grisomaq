"use client";

import { useState } from "react";
import { MOTIVOS_PEDIDO, type Peca } from "@/db/schema";
import { PecaAutocomplete } from "./PecaAutocomplete";
import { useCurrentUserName } from "@/lib/user";
import { useSession } from "./SessionProvider";
import { FileInput } from "./FileInput";
import { AutoTextarea } from "./AutoTextarea";
import clsx from "clsx";

export type PedidoPrefill = {
  frota?: string;
  local?: string;
  modeloVeiculo?: string | null;
  anoVeiculo?: string | null;
  descricao?: string;
  codigoPeca?: string | null;
  fabricante?: string | null;
  quantidade?: number;
  unidade?: string;
  motivo?: string;
  prioridade?: "normal" | "urgente";
  observacoes?: string;
  pecaId?: number | null;
};

type Props = {
  onClose: () => void;
  onCreated: () => void;
  prefill?: PedidoPrefill;
  locaisConhecidos?: string[];
};

const LOCAIS_SUGERIDOS_DEFAULT = [
  "Frente 15",
  "Frente 34",
  "Frente 103",
  "Pátio",
  "Oficina",
];

export function NovoPedidoDialog({
  onClose,
  onCreated,
  prefill,
  locaisConhecidos = [],
}: Props) {
  const { nome } = useSession();
  const [frota, setFrota] = useState(prefill?.frota ?? "");
  const [local, setLocal] = useState(prefill?.local ?? "");
  const [modeloVeiculo, setModeloVeiculo] = useState(
    prefill?.modeloVeiculo ?? ""
  );
  const [anoVeiculo, setAnoVeiculo] = useState(prefill?.anoVeiculo ?? "");
  const [descricao, setDescricao] = useState(prefill?.descricao ?? "");
  const [codigoPeca, setCodigoPeca] = useState(prefill?.codigoPeca ?? "");
  const [fabricante, setFabricante] = useState(prefill?.fabricante ?? "");
  const [peca, setPeca] = useState<Peca | null>(null);
  const [qtd, setQtd] = useState<number>(prefill?.quantidade ?? 1);
  const [unidade, setUnidade] = useState(prefill?.unidade ?? "un");
  const motivoInicial = (MOTIVOS_PEDIDO as readonly string[]).includes(
    prefill?.motivo ?? ""
  )
    ? (prefill!.motivo as (typeof MOTIVOS_PEDIDO)[number])
    : prefill?.motivo
    ? "Outro"
    : MOTIVOS_PEDIDO[0];
  const [motivo, setMotivo] = useState<(typeof MOTIVOS_PEDIDO)[number]>(
    motivoInicial as any
  );
  const [motivoOutro, setMotivoOutro] = useState(
    motivoInicial === "Outro" ? prefill?.motivo ?? "" : ""
  );
  const [prioridade, setPrioridade] = useState<"normal" | "urgente">(
    prefill?.prioridade ?? "normal"
  );
  const [observacoes, setObservacoes] = useState(prefill?.observacoes ?? "");
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
        } else {
          const j = await up.json().catch(() => ({}));
          throw new Error(
            j.error === "arquivo_muito_grande"
              ? `Foto muito grande (máx ${j.limiteMb ?? 8}MB). Tira uma foto menor ou envia sem foto.`
              : j.error === "blob_nao_configurado"
              ? "Upload de foto não configurado no servidor."
              : "Falha ao enviar a foto. Tenta sem foto ou usa arquivo menor."
          );
        }
      }
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frota,
          local: local.trim() || null,
          modeloVeiculo: modeloVeiculo.trim() || null,
          anoVeiculo: anoVeiculo.trim() || null,
          codigoPeca: (codigoPeca || peca?.codigo || "").trim() || null,
          fabricante: fabricante.trim() || null,
          descricao: peca ? peca.nome : descricao,
          quantidade: qtd,
          unidade: peca ? peca.unidade : unidade,
          motivo:
            motivo === "Outro" && motivoOutro.trim()
              ? motivoOutro.trim().slice(0, 150)
              : motivo,
          prioridade,
          observacoes: observacoes || null,
          fotoUrl,
          pecaId: peca?.id ?? null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j.error === "dados_invalidos" && j.detalhes?.fieldErrors) {
          const campos = Object.keys(j.detalhes.fieldErrors);
          throw new Error(
            "Preenchimento inválido nos campos: " + campos.join(", ")
          );
        }
        throw new Error(j.mensagem ?? j.error ?? "Falha ao registrar pedido");
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-form">Frota / Equipamento</label>
            <input
              className="input-base"
              required
              placeholder="Ex: Frota 95, Trator 5508"
              value={frota}
              onChange={(e) => setFrota(e.target.value)}
            />
          </div>
          <div>
            <label className="label-form">Local de trabalho</label>
            <input
              className="input-base"
              list="locais-conhecidos"
              placeholder="Ex: Frente 15, Frente 103, Pátio"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              maxLength={64}
            />
            <datalist id="locais-conhecidos">
              {[
                ...new Set([...locaisConhecidos, ...LOCAIS_SUGERIDOS_DEFAULT]),
              ].map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="label-form">Modelo do veículo (opcional)</label>
            <input
              className="input-base"
              placeholder="Ex: Volvo FH 540, John Deere 6135J"
              value={modeloVeiculo}
              onChange={(e) => setModeloVeiculo(e.target.value)}
              maxLength={128}
            />
          </div>
          <div>
            <label className="label-form">Ano</label>
            <input
              className="input-base"
              placeholder="Ex: 2022"
              value={anoVeiculo}
              onChange={(e) => setAnoVeiculo(e.target.value)}
              maxLength={16}
            />
          </div>
        </div>
        <div>
          <label className="label-form">Peça / Descrição</label>
          <PecaAutocomplete
            valor={descricao}
            onValor={setDescricao}
            onPeca={(p) => {
              setPeca(p);
              if (p?.codigo && !codigoPeca) setCodigoPeca(p.codigo);
            }}
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
            <label className="label-form">Código da peça (opcional)</label>
            <input
              className="input-base font-mono"
              placeholder="Ex: 21715165, MB-A0001234"
              value={codigoPeca}
              onChange={(e) => setCodigoPeca(e.target.value)}
              maxLength={64}
            />
          </div>
          <div>
            <label className="label-form">Fabricante (opcional)</label>
            <input
              className="input-base"
              placeholder="Ex: Bosch, Volvo, John Deere"
              value={fabricante}
              onChange={(e) => setFabricante(e.target.value)}
              maxLength={128}
            />
          </div>
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
          {motivo === "Outro" && (
            <>
              <input
                className="input-base mt-2"
                placeholder="Descreva o motivo…"
                value={motivoOutro}
                onChange={(e) => setMotivoOutro(e.target.value)}
                required
                maxLength={150}
              />
              <div
                className="mt-1 text-right font-mono text-[10px]"
                style={{
                  color:
                    motivoOutro.length > 130
                      ? "var(--warning)"
                      : "var(--text-muted)",
                }}
              >
                {motivoOutro.length}/150
              </div>
            </>
          )}
        </div>
        <div>
          <label className="label-form">Solicitante</label>
          <input className="input-base" value={nome} disabled />
          <p
            className="mt-1 text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
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
              className="rounded-md border px-3 py-2 text-sm font-semibold transition"
              style={
                prioridade === "normal"
                  ? {
                      background: "var(--brand)",
                      borderColor: "var(--brand)",
                      color: "#000",
                    }
                  : {
                      background: "var(--surface)",
                      borderColor: "var(--border)",
                      color: "var(--text-muted)",
                    }
              }
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => setPrioridade("urgente")}
              className="rounded-md border px-3 py-2 text-sm font-semibold transition"
              style={
                prioridade === "urgente"
                  ? {
                      background: "var(--danger)",
                      borderColor: "var(--danger)",
                      color: "#fff",
                    }
                  : {
                      background: "var(--surface)",
                      borderColor: "var(--border)",
                      color: "var(--text-muted)",
                    }
              }
            >
              🔴 Urgente
            </button>
          </div>
        </div>
        <div>
          <label className="label-form">
            Foto da peça (opcional, ajuda muito)
          </label>
          <FileInput file={foto} onFile={setFoto} accept="image/*" />
        </div>
        <div>
          <label className="label-form">Observações (opcional)</label>
          <AutoTextarea
            minRows={3}
            maxRows={10}
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
  const toneStyle: React.CSSProperties =
    badgeTone === "vermelho"
      ? { background: "var(--danger)", color: "#fff" }
      : badgeTone === "cinza"
      ? { background: "var(--surface-3)", color: "var(--text-muted)" }
      : badgeTone === "amarelo"
      ? { background: "var(--warning)", color: "#fff" }
      : { background: "var(--brand)", color: "#000" };
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-4 backdrop-blur-sm"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="card mt-8 w-full max-w-xl p-5"
        style={{ boxShadow: "var(--shadow-md)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          {tituloBadge ? (
            <span
              className="rounded-md px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest"
              style={toneStyle}
            >
              {tituloBadge}
            </span>
          ) : (
            <div />
          )}
          <button
            className="btn-ghost"
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
