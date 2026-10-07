"use client";

import { useState } from "react";
import { MOTIVOS_PEDIDO, type Peca } from "@/db/schema";
import { PecaAutocomplete } from "./PecaAutocomplete";
import { FrotaAutocomplete } from "./FrotaAutocomplete";
import { useCurrentUserName } from "@/lib/user";
import { useSession } from "./SessionProvider";
import { FileInput } from "./FileInput";
import { AutoTextarea } from "./AutoTextarea";
import { formatSaldo, toNum as toNumSaldo } from "@/lib/formatSaldo";
import clsx from "clsx";

// Item do pedido no formulário. Carrega peca inteira pra UI (mostrar saldo
// vinculado); só pecaId vai no POST.
type ItemForm = {
  uid: string; // chave estável do React (não vai pro servidor)
  descricao: string;
  codigoPeca: string;
  fabricante: string;
  quantidade: number;
  unidade: string;
  peca: Peca | null;
};

export type PedidoPrefill = {
  frota?: string;
  local?: string;
  modeloVeiculo?: string | null;
  anoVeiculo?: string | null;
  motivo?: string;
  prioridade?: "normal" | "urgente";
  observacoes?: string;
  itens?: {
    descricao?: string;
    codigoPeca?: string | null;
    fabricante?: string | null;
    quantidade?: number;
    unidade?: string;
    pecaId?: number | null;
  }[];
  // Legado (duplicar pedido antigo que tinha só 1 peça):
  descricao?: string;
  codigoPeca?: string | null;
  fabricante?: string | null;
  quantidade?: number;
  unidade?: string;
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

const MAX_ITENS = 20;

function novoUid() {
  return Math.random().toString(36).slice(2, 10);
}

function itemVazio(): ItemForm {
  return {
    uid: novoUid(),
    descricao: "",
    codigoPeca: "",
    fabricante: "",
    quantidade: 1,
    unidade: "un",
    peca: null,
  };
}

function itensIniciais(prefill?: PedidoPrefill): ItemForm[] {
  if (prefill?.itens && prefill.itens.length > 0) {
    return prefill.itens.map((it) => ({
      uid: novoUid(),
      descricao: it.descricao ?? "",
      codigoPeca: it.codigoPeca ?? "",
      fabricante: it.fabricante ?? "",
      quantidade: it.quantidade ?? 1,
      unidade: it.unidade ?? "un",
      peca: null,
    }));
  }
  // Prefill legado (campos achatados) → 1 item
  if (
    prefill?.descricao ||
    prefill?.codigoPeca ||
    prefill?.quantidade ||
    prefill?.unidade
  ) {
    return [
      {
        uid: novoUid(),
        descricao: prefill.descricao ?? "",
        codigoPeca: prefill.codigoPeca ?? "",
        fabricante: prefill.fabricante ?? "",
        quantidade: prefill.quantidade ?? 1,
        unidade: prefill.unidade ?? "un",
        peca: null,
      },
    ];
  }
  return [itemVazio()];
}

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
  const [itens, setItens] = useState<ItemForm[]>(() => itensIniciais(prefill));
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

  function atualizarItem(uid: string, patch: Partial<ItemForm>) {
    setItens((prev) =>
      prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it))
    );
  }
  function removerItem(uid: string) {
    setItens((prev) =>
      prev.length <= 1 ? prev : prev.filter((it) => it.uid !== uid)
    );
  }
  function adicionarItem() {
    setItens((prev) =>
      prev.length >= MAX_ITENS ? prev : [...prev, itemVazio()]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    // Validação local — pelo menos descricao em cada item + qtd > 0
    for (const it of itens) {
      const desc = (it.peca?.nome ?? it.descricao).trim();
      if (!desc) {
        setErro("Preencha a peça/descrição em todos os itens.");
        return;
      }
      if (!Number.isFinite(it.quantidade) || it.quantidade < 1) {
        setErro(`Quantidade inválida em "${desc}".`);
        return;
      }
    }

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

      const payloadItens = itens.map((it) => ({
        descricao: (it.peca?.nome ?? it.descricao).trim(),
        codigoPeca:
          (it.codigoPeca || it.peca?.codigo || "").trim() || null,
        fabricante: it.fabricante.trim() || null,
        quantidade: it.quantidade,
        unidade: it.peca?.unidade || it.unidade || "un",
        pecaId: it.peca?.id ?? null,
      }));

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frota,
          local: local.trim() || null,
          modeloVeiculo: modeloVeiculo.trim() || null,
          anoVeiculo: anoVeiculo.trim() || null,
          motivo:
            motivo === "Outro" && motivoOutro.trim()
              ? motivoOutro.trim().slice(0, 150)
              : motivo,
          prioridade,
          observacoes: observacoes || null,
          fotoUrl,
          itens: payloadItens,
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
            <label className="label-form">Frota / Equipamento / CO</label>
            <FrotaAutocomplete
              valor={frota}
              onValor={setFrota}
              required
              placeholder="Nº da frota, CO, modelo ou placa…"
              onFrota={(f) => {
                if (!f) return;
                if (!modeloVeiculo && f.modelo) {
                  setModeloVeiculo(
                    f.marca && !f.modelo.toUpperCase().startsWith(f.marca.toUpperCase())
                      ? `${f.marca} ${f.modelo}`
                      : f.modelo
                  );
                }
                if (!anoVeiculo && f.ano) {
                  setAnoVeiculo(f.ano);
                }
              }}
            />
            <p
              className="mt-1 text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              Manutenção de oficina, silo ou setor? Digite CO (ex.: CO37).
            </p>
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

        {/* Lista de itens */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="label-form mb-0">
              Peças do pedido {itens.length > 1 && `(${itens.length})`}
            </label>
            <button
              type="button"
              className="btn-ghost text-xs"
              disabled={itens.length >= MAX_ITENS}
              onClick={adicionarItem}
            >
              + Adicionar peça
            </button>
          </div>
          {itens.map((it, idx) => (
            <ItemBlock
              key={it.uid}
              indice={idx + 1}
              total={itens.length}
              item={it}
              onPatch={(patch) => atualizarItem(it.uid, patch)}
              onRemover={() => removerItem(it.uid)}
            />
          ))}
          {itens.length >= MAX_ITENS && (
            <p className="text-[10px]" style={{ color: "var(--warning)" }}>
              Limite máximo de {MAX_ITENS} peças por pedido.
            </p>
          )}
        </div>

        <div>
          <label className="label-form">Motivo (um para todas as peças)</label>
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
            {salvando
              ? "Registrando…"
              : itens.length === 1
              ? "Registrar pedido"
              : `Registrar pedido com ${itens.length} peças`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ItemBlock({
  indice,
  total,
  item,
  onPatch,
  onRemover,
}: {
  indice: number;
  total: number;
  item: ItemForm;
  onPatch: (patch: Partial<ItemForm>) => void;
  onRemover: () => void;
}) {
  const podeRemover = total > 1;
  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className="rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: "var(--surface-3)",
            color: "var(--text-muted)",
          }}
        >
          Peça {indice}
        </span>
        {podeRemover && (
          <button
            type="button"
            className="text-xs"
            style={{ color: "var(--danger)" }}
            onClick={onRemover}
            aria-label="Remover peça"
          >
            🗑 Remover
          </button>
        )}
      </div>
      <div>
        <label className="label-form">Peça / Descrição</label>
        <PecaAutocomplete
          valor={item.descricao}
          onValor={(v) => onPatch({ descricao: v })}
          onPeca={(p) => {
            // CRÍTICO: só patchear quando o usuário SELECIONOU uma peça
            // (p truthy). O PecaAutocomplete chama onPeca(null) a cada
            // keystroke pra invalidar seleção anterior — se tocarmos em
            // `descricao` nesse caso, sobrescrevemos a letra digitada
            // com `item.descricao` do closure (valor stale) e o campo
            // vira impossível de digitar (especialmente no mobile).
            if (!p) {
              if (item.peca) onPatch({ peca: null });
              return;
            }
            onPatch({
              peca: p,
              descricao: p.nome,
              codigoPeca: item.codigoPeca || p.codigo || "",
              unidade: p.unidade,
            });
          }}
        />
        {item.peca && (
          <div className="mt-1 text-xs text-oliva-700">
            Vinculado ao estoque:{" "}
            <span className="font-semibold">{item.peca.nome}</span> · saldo
            atual{" "}
            <span
              className={clsx(
                "font-mono",
                toNumSaldo(item.peca.saldo) === 0
                  ? "text-red-600"
                  : toNumSaldo(item.peca.saldo) <= toNumSaldo(item.peca.minimo)
                  ? "text-amber-700"
                  : "text-oliva-700"
              )}
            >
              {formatSaldo(item.peca.saldo, item.peca.unidade)}{" "}
              {item.peca.unidade}
            </span>
            . Ao ser entregue o saldo baixa automaticamente.
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="label-form">Código da peça (opcional)</label>
          <PecaAutocomplete
            porCodigo
            valor={item.codigoPeca}
            onValor={(v) => onPatch({ codigoPeca: v })}
            placeholder="Ex: 5569, 21715165, MB-A0001234"
            onPeca={(p) => {
              if (!p) return;
              onPatch({
                peca: p,
                descricao: p.nome,
                unidade: p.unidade,
                codigoPeca: p.codigo ?? item.codigoPeca,
              });
            }}
          />
        </div>
        <div>
          <label className="label-form">Fabricante (opcional)</label>
          <input
            className="input-base"
            placeholder="Ex: Bosch, Volvo, John Deere"
            value={item.fabricante}
            onChange={(e) => onPatch({ fabricante: e.target.value })}
            maxLength={128}
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="label-form">Quantidade</label>
          <input
            type="number"
            min={1}
            className="input-base"
            value={item.quantidade}
            onChange={(e) =>
              onPatch({ quantidade: Number(e.target.value) || 1 })
            }
            required
          />
        </div>
        <div>
          <label className="label-form">Unidade</label>
          <input
            className="input-base"
            placeholder="un, m, L…"
            value={item.peca ? item.peca.unidade : item.unidade}
            onChange={(e) => onPatch({ unidade: e.target.value })}
            disabled={!!item.peca}
          />
        </div>
      </div>
    </div>
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
