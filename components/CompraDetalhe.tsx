"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  STATUS_COMPRA_LABELS,
  STATUS_COMPRA_TRILHO,
  type Compra,
  type CompraEvento,
  type Peca,
  type Pedido,
} from "@/db/schema";
import { formatBR, formatBRDia } from "@/lib/date";
import { useCurrentUserName } from "@/lib/user";
import { useIsAdmin } from "./SessionProvider";
import { ConfirmDialog } from "./PedidoDetalheDialog";
import { FileInput } from "./FileInput";
import { parseMoney } from "@/lib/parseMoney";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function CompraDetalhe({ id }: { id: number }) {
  const router = useRouter();
  const { nome } = useCurrentUserName();
  const isAdmin = useIsAdmin();
  const { data, mutate } = useSWR<{
    compra: Compra;
    eventos: CompraEvento[];
    peca: Peca | null;
    pedidoVinculado: Pedido | null;
  }>(`/api/compras/${id}`, fetcher, { refreshInterval: 4000 });

  const [nf, setNf] = useState("");
  const [nfFile, setNfFile] = useState<File | null>(null);
  const [confirmarReceber, setConfirmarReceber] = useState(false);
  const [confirmCancelar, setConfirmCancelar] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Modal de avanço com dados obrigatórios (aprovar/comprar)
  const [avancarPara, setAvancarPara] = useState<Compra["status"] | null>(null);
  const [aFornecedor, setAFornecedor] = useState("");
  const [aValorUnit, setAValorUnit] = useState("");
  const [aCondicao, setACondicao] = useState("");
  const [avancarErro, setAvancarErro] = useState<string | null>(null);
  const [avancarCampos, setAvancarCampos] = useState<string[]>([]);

  if (!data) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Carregando…
      </div>
    );
  }
  const c = data.compra;
  const trilhoIdx = STATUS_COMPRA_TRILHO.indexOf(c.status as any);

  async function avancar(next: Compra["status"]) {
    setSalvando(true);
    await fetch(`/api/compras/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await mutate();
    setSalvando(false);
  }

  function abrirAvancar(next: "aprovada" | "comprada") {
    setAvancarPara(next);
    setAFornecedor(c.fornecedor ?? "");
    setAValorUnit(c.valorUnit ?? "");
    setACondicao(c.condicaoPagamento ?? "");
    setAvancarErro(null);
    setAvancarCampos([]);
  }

  async function confirmarAvancar() {
    if (!avancarPara) return;
    setSalvando(true);
    setAvancarErro(null);
    setAvancarCampos([]);
    const body: any = { status: avancarPara };
    if (aFornecedor.trim() && aFornecedor.trim() !== c.fornecedor) {
      body.fornecedor = aFornecedor.trim();
    }
    const v = parseMoney(aValorUnit);
    if (v != null) body.valorUnit = v;
    if (avancarPara === "comprada" && aCondicao.trim()) {
      body.condicaoPagamento = aCondicao.trim();
    }
    const res = await fetch(`/api/compras/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSalvando(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      if (j.error === "dados_pendentes") {
        setAvancarCampos(j.camposFaltando ?? []);
        setAvancarErro(j.mensagem ?? "Preencha os campos obrigatórios.");
      } else {
        setAvancarErro(j.mensagem ?? j.error ?? "Falha ao avançar.");
      }
      return;
    }
    setAvancarPara(null);
    await mutate();
  }

  async function receber() {
    setSalvando(true);
    let nfUrl: string | null = null;
    if (nfFile) {
      const fd = new FormData();
      fd.append("file", nfFile);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      if (up.ok) {
        const j = await up.json();
        nfUrl = j.url;
      }
    }
    await fetch(`/api/compras/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "recebida",
        nfNumero: nf || null,
        nfUrl,
      }),
    });
    await mutate();
    setConfirmarReceber(false);
    setSalvando(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Compras
          </div>
          <h1
            className="text-2xl font-black tracking-tight"
            style={{ color: "var(--text)" }}
          >
            Solicitação #{c.id}
          </h1>
        </div>
        <Link href="/compras" className="btn-secondary">
          ← Voltar
        </Link>
      </div>

      {/* Trilho de status */}
      <div className="card p-4">
        <div className="flex items-center gap-1">
          {STATUS_COMPRA_TRILHO.map((s, i) => {
            const ativo = i <= trilhoIdx && c.status !== "cancelada";
            const atual = STATUS_COMPRA_TRILHO[trilhoIdx] === s && c.status !== "cancelada";
            const style: React.CSSProperties = atual
              ? { background: "var(--brand)", color: "#000", border: "1px solid var(--brand)" }
              : ativo
              ? {
                  background: "var(--brand-soft)",
                  color: "var(--brand)",
                  border: "1px solid var(--brand-border)",
                }
              : {
                  background: "var(--surface-3)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                };
            return (
              <div key={s} className="flex flex-1 items-center gap-1">
                <div
                  className="flex h-9 flex-1 items-center justify-center rounded-md text-[10px] font-bold uppercase tracking-widest"
                  style={style}
                >
                  {STATUS_COMPRA_LABELS[s]}
                </div>
                {i < STATUS_COMPRA_TRILHO.length - 1 && (
                  <div
                    className="h-0.5 w-3 rounded-full"
                    style={{
                      background:
                        i < trilhoIdx && c.status !== "cancelada"
                          ? "var(--brand)"
                          : "var(--border)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
        {c.status === "cancelada" && (
          <div
            className="mt-3 text-center text-sm font-bold"
            style={{ color: "var(--danger)" }}
          >
            Solicitação cancelada.
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card
          label="Peça"
          value={
            <>
              <div className="font-semibold">{c.descricao}</div>
              <div
                className="font-mono text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                {c.quantidade} {c.unidade}
              </div>
            </>
          }
        />
        <Card label="Fornecedor" value={c.fornecedor || "—"} />
        {isAdmin && (
          <>
            <Card
              label="Valor unit."
              value={c.valorUnit ? `R$ ${c.valorUnit}` : "—"}
            />
            <Card
              label={c.status === "recebida" ? "Valor pago" : "Valor previsto"}
              value={c.valorTotal ? `R$ ${c.valorTotal}` : "—"}
            />
            <Card
              label="Condição de pagamento"
              value={c.condicaoPagamento || "—"}
            />
          </>
        )}
        <Card
          label="Prazo desejado"
          value={c.prazo ? formatBRDia(c.prazo) : "—"}
        />
        <Card label="Criado por" value={`${c.autor} · ${formatBR(c.criadoEm)}`} />
        {c.pedidoId && (
          <Card
            label="Pedido vinculado"
            value={
              <Link
                href="/pedidos"
                className="font-semibold hover:underline"
                style={{ color: "var(--brand)" }}
              >
                #{c.pedidoId}
                {data.pedidoVinculado &&
                  ` · ${data.pedidoVinculado.frota} — ${data.pedidoVinculado.descricao}`}
              </Link>
            }
          />
        )}
        {data.peca && (
          <Card
            label="Peça no estoque"
            value={
              <>
                <div className="font-semibold">{data.peca.nome}</div>
                <div className="font-mono text-xs">
                  Saldo atual: {data.peca.saldo} {data.peca.unidade}
                </div>
              </>
            }
          />
        )}
        {c.nfNumero && (
          <Card
            label="Nota fiscal"
            value={
              <>
                <div className="font-semibold">{c.nfNumero}</div>
                {c.nfUrl && (
                  <a
                    href={c.nfUrl}
                    target="_blank"
                    className="text-xs underline"
                    style={{ color: "var(--text-muted)" }}
                    rel="noopener"
                  >
                    Abrir arquivo
                  </a>
                )}
              </>
            }
          />
        )}
      </div>

      {c.observacoes && (
        <div
          className="rounded-md p-3 text-sm"
          style={{ background: "var(--surface-3)", color: "var(--text)" }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Observações
          </div>
          {c.observacoes}
        </div>
      )}

      {/* Ações — só admin */}
      {isAdmin && (
      <div className="card flex flex-wrap items-center gap-2 p-3">
        {c.status === "rascunho" && (
          <button
            className="btn-primary"
            disabled={salvando}
            onClick={() => abrirAvancar("aprovada")}
          >
            ✔ Aprovar
          </button>
        )}
        {c.status === "aprovada" && (
          <button
            className="btn-primary"
            disabled={salvando}
            onClick={() => abrirAvancar("comprada")}
          >
            💳 Marcar como comprada
          </button>
        )}
        {c.status === "comprada" && (
          <button
            className="btn-primary"
            disabled={salvando}
            onClick={() => setConfirmarReceber(true)}
          >
            📦 Marcar como recebida
          </button>
        )}
        {c.status === "rascunho" && (
          <button
            className="btn-danger ml-auto"
            disabled={salvando}
            onClick={() => setConfirmExcluir(true)}
            title="Apaga definitivamente — use quando criou por engano"
          >
            🗑 Excluir rascunho
          </button>
        )}
        {["aprovada", "comprada"].includes(c.status) && (
          <button
            className="btn-danger ml-auto"
            disabled={salvando}
            onClick={() => setConfirmCancelar(true)}
          >
            Cancelar solicitação
          </button>
        )}
        {["recebida", "cancelada"].includes(c.status) && (
          <button
            className="btn-ghost ml-auto !text-[11px]"
            style={{ color: "var(--text-dim)" }}
            disabled={salvando}
            onClick={() => setConfirmExcluir(true)}
            title="Exclusão forçada — só use pra limpar registros de teste"
          >
            🗑 Excluir permanentemente
          </button>
        )}
      </div>
      )}

      {/* Histórico */}
      <div>
        <div
          className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Histórico
        </div>
        <ul className="space-y-1 text-sm">
          {data.eventos.map((ev) => (
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
      </div>

      {/* Modal de avanço com dados obrigatórios */}
      {avancarPara && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setAvancarPara(null)}
        >
          <div
            className="card w-full max-w-md p-5"
            style={{ boxShadow: "var(--shadow-md)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-lg font-bold tracking-tight">
              {avancarPara === "aprovada"
                ? "Aprovar solicitação"
                : "Marcar como comprada"}
            </h3>
            <p
              className="mb-4 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {avancarPara === "aprovada"
                ? "Fornecedor e valor unitário são obrigatórios pra aprovar."
                : "Confirma a condição de pagamento pra registrar a compra."}
            </p>

            <label className="label-form">Fornecedor</label>
            <input
              className="input-base"
              value={aFornecedor}
              onChange={(e) => setAFornecedor(e.target.value)}
              placeholder="Nome do fornecedor"
              maxLength={128}
              style={
                avancarCampos.includes("fornecedor")
                  ? { borderColor: "var(--danger)" }
                  : undefined
              }
            />

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="label-form">Valor unitário (R$)</label>
                <input
                  className="input-base"
                  inputMode="decimal"
                  value={aValorUnit}
                  onChange={(e) => setAValorUnit(e.target.value)}
                  placeholder="Ex: 89,90"
                  style={
                    avancarCampos.includes("valorUnit")
                      ? { borderColor: "var(--danger)" }
                      : undefined
                  }
                />
              </div>
              <div>
                <label className="label-form">Total (auto)</label>
                <input
                  className="input-base font-mono"
                  disabled
                  value={
                    aValorUnit && !Number.isNaN(Number(aValorUnit.replace(",", ".")))
                      ? `R$ ${(
                          Number(aValorUnit.replace(",", ".")) * c.quantidade
                        ).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}`
                      : "—"
                  }
                />
              </div>
            </div>

            {avancarPara === "comprada" && (
              <div className="mt-3">
                <label className="label-form">Condição de pagamento *</label>
                <input
                  className="input-base"
                  list="cond-pagamento-avancar"
                  value={aCondicao}
                  onChange={(e) => setACondicao(e.target.value)}
                  placeholder="Ex: À vista, 30 dias, PIX"
                  maxLength={128}
                  style={
                    avancarCampos.includes("condicaoPagamento")
                      ? { borderColor: "var(--danger)" }
                      : undefined
                  }
                />
                <datalist id="cond-pagamento-avancar">
                  <option value="À vista" />
                  <option value="7 dias" />
                  <option value="15 dias" />
                  <option value="30 dias" />
                  <option value="30/60" />
                  <option value="30/60/90" />
                  <option value="Boleto" />
                  <option value="PIX" />
                  <option value="Cartão CNPJ" />
                  <option value="Faturado" />
                </datalist>
              </div>
            )}

            {avancarErro && (
              <div
                className="mt-3 rounded-md border p-2 text-sm"
                style={{
                  borderColor: "var(--danger-border)",
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                }}
              >
                {avancarErro}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() => setAvancarPara(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                disabled={salvando}
                onClick={confirmarAvancar}
              >
                {salvando
                  ? "Salvando…"
                  : avancarPara === "aprovada"
                  ? "Aprovar"
                  : "Confirmar compra"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmCancelar && (
        <ConfirmDialog
          titulo="Cancelar esta solicitação?"
          descricao="A compra ficará com status Cancelada mas continua no histórico."
          confirmar="Sim, cancelar"
          tone="danger"
          onClose={() => setConfirmCancelar(false)}
          onConfirm={async () => {
            setConfirmCancelar(false);
            await avancar("cancelada");
          }}
        />
      )}
      {confirmExcluir && (
        <ConfirmDialog
          titulo={
            c.status === "rascunho"
              ? "Excluir esta solicitação de compra?"
              : "Excluir compra já efetivada?"
          }
          descricao={
            c.status === "rascunho"
              ? "Isso apaga o rascunho PERMANENTEMENTE — não fica no histórico. Use apenas quando criou por engano."
              : `Essa compra está "${c.status}" e já pode ter movimentado o estoque. Excluir vai apagar o registro mas o saldo do estoque atual NÃO será desfeito. Use apenas pra limpar dados de teste.`
          }
          confirmar="Sim, excluir definitivo"
          tone="danger"
          onClose={() => setConfirmExcluir(false)}
          onConfirm={async () => {
            setSalvando(true);
            const url =
              c.status === "rascunho"
                ? `/api/compras/${id}`
                : `/api/compras/${id}?force=true`;
            const res = await fetch(url, { method: "DELETE" });
            setSalvando(false);
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              alert(j.mensagem ?? "Falha ao excluir.");
              setConfirmExcluir(false);
              return;
            }
            router.push("/compras");
            router.refresh();
          }}
        />
      )}

      {/* Modal receber com NF */}
      {confirmarReceber && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setConfirmarReceber(false)}
        >
          <div
            className="card w-full max-w-md p-5"
            style={{ boxShadow: "var(--shadow-md)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="mb-2 text-lg font-bold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              Confirmar recebimento
            </h3>
            <p
              className="mb-3 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Isso dá entrada de <b>{c.quantidade} {c.unidade}</b> no estoque
              {data.peca ? ` de ${data.peca.nome}` : ""}.
              {c.pedidoId && (
                <>
                  {" "}
                  O pedido #{c.pedidoId} será movido para{" "}
                  <b>aguardando retirada</b>.
                </>
              )}
            </p>
            <label className="label-form">Número da NF (opcional)</label>
            <input
              className="input-base"
              value={nf}
              onChange={(e) => setNf(e.target.value)}
              placeholder="Ex: 12345"
            />
            <label className="label-form mt-3">
              Arquivo da NF (opcional)
            </label>
            <FileInput
              file={nfFile}
              onFile={setNfFile}
              accept="application/pdf,image/*"
              label="Anexar NF"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() => setConfirmarReceber(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                disabled={salvando}
                onClick={receber}
              >
                {salvando ? "Recebendo…" : "Confirmar recebimento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      className="rounded-md border p-3"
      style={{ background: "var(--surface-3)", borderColor: "var(--border)" }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div className="text-sm" style={{ color: "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}
