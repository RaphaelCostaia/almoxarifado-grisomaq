"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PecaAutocomplete } from "./PecaAutocomplete";
import { useCurrentUserName } from "@/lib/user";
import { useIsAdmin } from "./SessionProvider";
import { AutoTextarea } from "./AutoTextarea";
import { parseMoney } from "@/lib/parseMoney";
import type { Peca, Pedido } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Props = {
  pedidoId: number | null;
  pecaIdInicial: number | null;
  qtdInicial: number | null;
};

export function NovaCompraForm({
  pedidoId,
  pecaIdInicial,
  qtdInicial,
}: Props) {
  const router = useRouter();
  const { nome } = useCurrentUserName();
  const isAdmin = useIsAdmin();

  const [descricao, setDescricao] = useState("");
  const [peca, setPeca] = useState<Peca | null>(null);
  const [qtd, setQtd] = useState(qtdInicial ?? 1);
  const [unidade, setUnidade] = useState("un");
  const [fornecedor, setFornecedor] = useState("");
  const [valorUnit, setValorUnit] = useState<string>("");
  const [condicaoPagamento, setCondicaoPagamento] = useState("");
  const [prazo, setPrazo] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Pré-carrega peça e pedido (quando disparado a partir de um pedido)
  const { data: pecaPre } = useSWR<{ pecas: Peca[] }>(
    pecaIdInicial ? `/api/estoque` : null,
    fetcher
  );
  const { data: pedidoPre } = useSWR<{ pedido: Pedido }>(
    pedidoId ? `/api/pedidos/${pedidoId}` : null,
    fetcher
  );

  useEffect(() => {
    if (pecaIdInicial && pecaPre) {
      const p = pecaPre.pecas.find((x) => x.id === pecaIdInicial);
      if (p) {
        setPeca(p);
        setDescricao(p.nome);
        setUnidade(p.unidade);
      }
    }
  }, [pecaIdInicial, pecaPre]);

  useEffect(() => {
    if (pedidoPre?.pedido) {
      if (!descricao) setDescricao(pedidoPre.pedido.descricao);
      if (!qtdInicial) setQtd(pedidoPre.pedido.quantidade);
      setUnidade(pedidoPre.pedido.unidade);
    }
  }, [pedidoPre, descricao, qtdInicial]);

  const totalNumero = parseMoney(valorUnit);
  const total = totalNumero != null ? totalNumero * qtd : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId: pedidoId ?? null,
          pecaId: peca?.id ?? null,
          descricao: peca ? peca.nome : descricao,
          quantidade: qtd,
          unidade: peca ? peca.unidade : unidade,
          fornecedor: fornecedor || null,
          valorUnit: parseMoney(valorUnit),
          condicaoPagamento: condicaoPagamento.trim() || null,
          prazo: prazo || null,
          observacoes: observacoes || null,
        }),
      });
      if (!res.ok) throw new Error("Falha ao registrar solicitação");
      const j = await res.json();
      router.push(`/compras/${j.compra.id}`);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-oliva-100 bg-creme-50 p-6 text-sm">
        Somente o administrador do almoxarifado pode registrar uma solicitação
        de compra. Se você precisa de uma peça, abra um pedido em{" "}
        <Link href="/pedidos" className="font-semibold underline">
          Pedidos
        </Link>{" "}
        que o almoxarife decide se compra.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-oliva-700">
            Compras
          </div>
          <h1 className="text-2xl font-black text-oliva-900">
            Nova solicitação de compra
          </h1>
          <p className="text-sm text-oliva-700">
            Registre uma solicitação para o fornecedor. Ao ser recebida, o
            estoque é atualizado sozinho.
          </p>
        </div>
        <Link href="/compras" className="btn-secondary">
          ← Voltar
        </Link>
      </div>

      {pedidoPre?.pedido && (
        <div className="mb-4 rounded-md border border-oliva-100 bg-creme-100 p-3 text-sm">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-oliva-700">
            Pedido vinculado
          </div>
          <Link
            href="/pedidos"
            className="mt-1 block font-semibold text-oliva-900 hover:underline"
          >
            #{pedidoPre.pedido.id} · {pedidoPre.pedido.frota} —{" "}
            {pedidoPre.pedido.descricao}
          </Link>
        </div>
      )}

      <form
        onSubmit={submit}
        className="space-y-4 rounded-xl border border-oliva-100 bg-creme-50 p-5 shadow-sm"
      >
        <div>
          <label className="label-form">Peça</label>
          <PecaAutocomplete
            valor={descricao}
            onValor={setDescricao}
            onPeca={(p) => {
              setPeca(p);
              if (p) setUnidade(p.unidade);
            }}
            placeholder="Buscar peça do estoque ou escrever novo item…"
          />
          {peca && (
            <div className="mt-1 text-xs text-oliva-700">
              Vinculado ao estoque:{" "}
              <span className="font-semibold">{peca.nome}</span>. Ao receber, o
              saldo será acrescido em <span className="font-mono">{qtd}</span>.
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
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
              value={peca ? peca.unidade : unidade}
              onChange={(e) => setUnidade(e.target.value)}
              disabled={!!peca}
            />
          </div>
          <div>
            <label className="label-form">Prazo desejado</label>
            <input
              type="date"
              className="input-base"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label-form">Fornecedor</label>
          <input
            className="input-base"
            value={fornecedor}
            onChange={(e) => setFornecedor(e.target.value)}
            placeholder="Ex: Casa das Peças, Autoelétrica Silva"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-form">Valor unitário (R$)</label>
            <input
              inputMode="decimal"
              className="input-base"
              value={valorUnit}
              onChange={(e) => setValorUnit(e.target.value)}
              placeholder="Ex: 89,90"
            />
          </div>
          <div>
            <label className="label-form">Valor total (calculado)</label>
            <input
              className="input-base bg-white font-mono"
              value={
                total != null
                  ? `R$ ${total.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}`
                  : ""
              }
              disabled
            />
          </div>
        </div>

        <div>
          <label className="label-form">Condição de pagamento</label>
          <input
            className="input-base"
            list="cond-pagamento-sugestoes"
            value={condicaoPagamento}
            onChange={(e) => setCondicaoPagamento(e.target.value)}
            placeholder="Ex: À vista, 30 dias, PIX, Boleto"
            maxLength={128}
          />
          <datalist id="cond-pagamento-sugestoes">
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
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Obrigatório antes de marcar como "Comprada".
          </p>
        </div>

        <div>
          <label className="label-form">Motivo / observações</label>
          <AutoTextarea
            minRows={3}
            maxRows={10}
            className="input-base"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Justificativa, especificações, links de cotação, etc."
          />
        </div>

        {erro && (
          <div className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {erro}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-oliva-700">
            A solicitação será criada como <b>Rascunho</b>. Você aprova, marca
            como comprada e depois recebida.
          </div>
          <button className="btn-primary" disabled={salvando}>
            {salvando ? "Registrando…" : "Registrar solicitação"}
          </button>
        </div>
      </form>
    </div>
  );
}
