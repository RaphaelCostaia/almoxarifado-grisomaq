"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import type { Peca } from "@/db/schema";
import { formatSaldo, toNum } from "@/lib/formatSaldo";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Props = {
  valor: string;
  onValor: (v: string) => void;
  onPeca: (p: Peca | null) => void;
  placeholder?: string;
  /**
   * Quando true, renderiza um <input> curto (adequado ao campo Código
   * da peça) e prioriza o código no dropdown. Ao selecionar, o valor
   * do input passa a ser o código; o consumidor decide o que fazer
   * com nome/unidade/saldo via onPeca.
   */
  porCodigo?: boolean;
};

export function PecaAutocomplete({
  valor,
  onValor,
  onPeca,
  placeholder,
  porCodigo = false,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [foco, setFoco] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  const q = valor.trim();
  const { data } = useSWR<{ pecas: Peca[] }>(
    q.length >= 2 ? `/api/estoque?q=${encodeURIComponent(q)}&limit=8` : null,
    fetcher
  );

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setAberto(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const opcoes = data?.pecas ?? [];

  // Ao selecionar por teclado ou clique, o valor do campo depende do modo:
  // - por descrição (padrão): usa nome
  // - por código: usa o código (o consumidor sobrescreve descrição via onPeca)
  const selecionar = (p: Peca) => {
    onValor(porCodigo ? p.codigo ?? "" : p.nome);
    onPeca(p);
    setAberto(false);
  };

  const inputComum = {
    value: valor,
    placeholder:
      placeholder ??
      (porCodigo ? "Ex: 5569, 21715165" : "Ex: 1 ventilador do ar condicionado"),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onValor(e.target.value);
      onPeca(null);
      setAberto(true);
    },
    onFocus: () => setAberto(true),
    onKeyDown: (
      e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFoco((f) => Math.min(opcoes.length - 1, f + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFoco((f) => Math.max(0, f - 1));
      } else if (e.key === "Enter" && foco >= 0 && opcoes[foco]) {
        e.preventDefault();
        selecionar(opcoes[foco]);
      }
    },
  };

  return (
    <div className="relative" ref={ref}>
      {porCodigo ? (
        <input
          type="text"
          className="input-base font-mono"
          {...(inputComum as any)}
        />
      ) : (
        <textarea
          rows={2}
          className="input-base resize-y"
          {...(inputComum as any)}
        />
      )}
      {aberto && opcoes.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-oliva-100 bg-white shadow-lg">
          <div className="border-b border-oliva-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-oliva-600">
            Peças cadastradas no estoque
          </div>
          {opcoes.map((p, i) => (
            <button
              type="button"
              key={p.id}
              onClick={() => selecionar(p)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-oliva-50 ${
                foco === i ? "bg-oliva-50" : ""
              }`}
            >
              {porCodigo ? (
                <span className="min-w-0 flex-1">
                  <span className="font-mono font-semibold text-oliva-900">
                    {p.codigo ?? "—"}
                  </span>
                  <span className="ml-2 truncate text-[11px] text-oliva-600">
                    {p.nome}
                  </span>
                </span>
              ) : (
                <span>
                  <span className="font-semibold text-oliva-900">{p.nome}</span>
                  {p.codigo && (
                    <span className="ml-2 font-mono text-[11px] text-oliva-600">
                      {p.codigo}
                    </span>
                  )}
                </span>
              )}
              <span
                className={`chip ${
                  toNum(p.saldo) === 0
                    ? "!bg-red-100 !text-red-700"
                    : toNum(p.saldo) <= toNum(p.minimo)
                    ? "!bg-amber-100 !text-amber-800"
                    : ""
                }`}
              >
                {formatSaldo(p.saldo, p.unidade)} {p.unidade}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
