"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import type { ManutencaoOrdem } from "@/db/schema";
import { STATUS_MANUTENCAO_LABELS } from "@/db/schema";
import { formatBR } from "@/lib/date";
import { ManutencaoConcluirDialog } from "./ManutencaoConcluirDialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const COLUNAS: {
  key: ManutencaoOrdem["status"];
  label: string;
  cor: string;
}[] = [
  { key: "programada", label: "Programada", cor: "var(--brand)" },
  { key: "em_execucao", label: "Em execução", cor: "var(--warning)" },
  { key: "concluida", label: "Concluída", cor: "var(--text-muted)" },
];

export function ManutencaoKanban() {
  const [q, setQ] = useState("");
  const [concluirId, setConcluirId] = useState<number | null>(null);
  const [detalheId, setDetalheId] = useState<number | null>(null);

  const params = new URLSearchParams();
  if (q) params.set("q", q);

  const { data, mutate } = useSWR<{ ordens: ManutencaoOrdem[] }>(
    `/api/admin/manutencao/ordens?${params}`,
    fetcher,
    { refreshInterval: 6000 }
  );

  const ordens = data?.ordens ?? [];

  const porStatus = useMemo(() => {
    const m = new Map<ManutencaoOrdem["status"], ManutencaoOrdem[]>();
    for (const c of COLUNAS) m.set(c.key, []);
    for (const o of ordens) {
      if (m.has(o.status)) m.get(o.status)!.push(o);
    }
    return m;
  }, [ordens]);

  async function mudarStatus(
    o: ManutencaoOrdem,
    novo: ManutencaoOrdem["status"]
  ) {
    if (novo === "concluida") {
      setConcluirId(o.id);
      return;
    }
    const res = await fetch(`/api/admin/manutencao/ordens/${o.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novo }),
    });
    if (res.ok) mutate();
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.mensagem ?? j.error ?? "Falha ao mudar status");
    }
  }

  async function cancelar(o: ManutencaoOrdem) {
    const ok = window.confirm(`Cancelar OS #${o.id}?`);
    if (!ok) return;
    const res = await fetch(`/api/admin/manutencao/ordens/${o.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelada" }),
    });
    if (res.ok) mutate();
  }

  async function excluir(o: ManutencaoOrdem) {
    const ok = window.confirm(
      `Excluir OS #${o.id} permanentemente? (soft delete — fica no audit_log)`
    );
    if (!ok) return;
    const res = await fetch(`/api/admin/manutencao/ordens/${o.id}`, {
      method: "DELETE",
    });
    if (res.ok) mutate();
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2 p-2.5">
        <input
          className="input-base flex-1"
          style={{ minWidth: 240 }}
          placeholder="Buscar frota, compartimento, peça…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span
          className="text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Programadas viram do "Relatório GMAIS" → botão "+ Programar" em cada
          linha.
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {COLUNAS.map((c) => (
          <div key={c.key} className="card p-2">
            <div className="mb-2 flex items-center justify-between px-2 py-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: c.cor }}
                />
                <span className="text-xs font-semibold uppercase tracking-widest">
                  {c.label}
                </span>
              </div>
              <span
                className="font-mono text-[10px]"
                style={{ color: "var(--text-muted)" }}
              >
                {(porStatus.get(c.key) ?? []).length}
              </span>
            </div>
            <div className="space-y-1.5">
              {(porStatus.get(c.key) ?? []).map((o) => (
                <OrdemCard
                  key={o.id}
                  o={o}
                  colStatus={c.key}
                  onAvancar={mudarStatus}
                  onCancelar={cancelar}
                  onExcluir={excluir}
                  onDetalhe={() => setDetalheId(o.id)}
                />
              ))}
              {(porStatus.get(c.key) ?? []).length === 0 && (
                <div
                  className="rounded border border-dashed p-4 text-center text-[11px]"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-dim)",
                  }}
                >
                  Nenhuma OS aqui.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {concluirId != null && (
        <ManutencaoConcluirDialog
          id={concluirId}
          onClose={() => setConcluirId(null)}
          onDone={() => {
            setConcluirId(null);
            mutate();
          }}
        />
      )}
      {detalheId != null && (
        <DetalheDialog
          id={detalheId}
          ordens={ordens}
          onClose={() => setDetalheId(null)}
        />
      )}
    </div>
  );
}

function OrdemCard({
  o,
  colStatus,
  onAvancar,
  onCancelar,
  onExcluir,
  onDetalhe,
}: {
  o: ManutencaoOrdem;
  colStatus: ManutencaoOrdem["status"];
  onAvancar: (o: ManutencaoOrdem, s: ManutencaoOrdem["status"]) => void;
  onCancelar: (o: ManutencaoOrdem) => void;
  onExcluir: (o: ManutencaoOrdem) => void;
  onDetalhe: () => void;
}) {
  return (
    <div
      className="rounded-md border p-2"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="chip !py-0.5 !text-[10px]"
              style={{
                background: "var(--brand-soft)",
                color: "var(--brand)",
              }}
            >
              {o.frotaNumero}
            </span>
            <span
              className="font-mono text-[9px]"
              style={{ color: "var(--text-muted)" }}
            >
              #{o.id}
            </span>
          </div>
          {o.frotaModelo && (
            <div
              className="mt-0.5 truncate text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {o.frotaModelo}
            </div>
          )}
          <div className="mt-1 text-xs font-semibold">
            {o.compartimentoTipo}
          </div>
          <div
            className="mt-1 truncate text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            {o.pecaCodigo && (
              <span className="font-mono">{o.pecaCodigo} · </span>
            )}
            {o.pecaDescricao ?? "(sem peça vinculada)"}
          </div>
          <div className="mt-1 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
            {o.quantidade} {o.unidade}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {colStatus === "programada" && (
          <button
            className="btn-ghost !text-[10px]"
            onClick={() => onAvancar(o, "em_execucao")}
            title="Marcar em execução"
          >
            ▶ Iniciar
          </button>
        )}
        {colStatus === "em_execucao" && (
          <>
            <button
              className="btn-primary !py-1 !text-[10px]"
              onClick={() => onAvancar(o, "concluida")}
            >
              ✓ Concluir
            </button>
            <button
              className="btn-ghost !text-[10px]"
              onClick={() => onAvancar(o, "programada")}
            >
              ← Voltar
            </button>
          </>
        )}
        {colStatus !== "concluida" && (
          <>
            <button
              className="btn-ghost !text-[10px]"
              onClick={() => onCancelar(o)}
            >
              Cancelar
            </button>
          </>
        )}
        <button
          className="btn-ghost !text-[10px]"
          onClick={onDetalhe}
        >
          Ver
        </button>
        {colStatus === "concluida" && (
          <button
            className="btn-ghost !text-[10px]"
            style={{ color: "var(--danger)" }}
            onClick={() => onExcluir(o)}
            title="Excluir (soft delete)"
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

function DetalheDialog({
  id,
  ordens,
  onClose,
}: {
  id: number;
  ordens: ManutencaoOrdem[];
  onClose: () => void;
}) {
  const o = ordens.find((x) => x.id === id);
  if (!o) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto p-4 backdrop-blur-sm"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg p-5"
        style={{ boxShadow: "var(--shadow-md)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div
              className="font-mono text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              OS #{o.id} · {STATUS_MANUTENCAO_LABELS[o.status]}
            </div>
            <div className="text-lg font-bold">
              Frota {o.frotaNumero} — {o.compartimentoTipo}
            </div>
            {o.frotaModelo && (
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {o.frotaModelo}
              </div>
            )}
          </div>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div
          className="grid grid-cols-2 gap-3 border-t pt-3 text-xs"
          style={{ borderColor: "var(--border)" }}
        >
          <Info label="Compartimento" v={`${o.compartimentoCodigo ?? "—"} · ${o.compartimentoTipo}`} />
          <Info label="Peça código" v={o.pecaCodigo ?? "—"} mono />
          <Info label="Peça" v={o.pecaDescricao ?? "—"} />
          <Info label="Quantidade" v={`${o.quantidade} ${o.unidade}`} mono />
          <Info label="Criado por" v={`${o.criadoPor} · ${formatBR(o.criadoEm)}`} />
          {o.iniciadoEm && (
            <Info label="Iniciado" v={`${o.iniciadoPor} · ${formatBR(o.iniciadoEm)}`} />
          )}
          {o.concluidoEm && (
            <Info
              label="Concluído"
              v={`${o.concluidoPor} · ${formatBR(o.concluidoEm)} · hod ${o.hodometroConcluido ?? "?"}`}
            />
          )}
          {o.observacoes && (
            <div className="col-span-2">
              <div
                className="font-mono text-[9px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}
              >
                Observações
              </div>
              <div>{o.observacoes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({
  label,
  v,
  mono,
}: {
  label: string;
  v: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        className="font-mono text-[9px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div className={mono ? "font-mono" : ""}>{v}</div>
    </div>
  );
}
