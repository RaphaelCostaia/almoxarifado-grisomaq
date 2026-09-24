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
        <div
          className="absolute z-30 mt-1 max-h-72 w-full overflow-x-hidden overflow-y-auto rounded-md border shadow-lg"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div
            className="sticky top-0 border-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--text-muted)",
            }}
          >
            Peças cadastradas no estoque
          </div>
          {opcoes.map((p, i) => {
            const saldoZero = toNum(p.saldo) === 0;
            const saldoBaixo =
              !saldoZero && toNum(p.saldo) <= toNum(p.minimo);
            const chipStyle: React.CSSProperties = saldoZero
              ? {
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                }
              : saldoBaixo
              ? {
                  background: "var(--warning-soft)",
                  color: "var(--warning)",
                }
              : {
                  background: "var(--surface-3)",
                  color: "var(--text-muted)",
                };
            const rowStyle: React.CSSProperties = {
              borderColor: "var(--border)",
              background:
                foco === i ? "var(--surface-3)" : "transparent",
            };
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => selecionar(p)}
                onMouseEnter={() => setFoco(i)}
                className="flex w-full items-start gap-3 border-b px-3 py-2 text-left last:border-b-0 transition"
                style={rowStyle}
              >
                <div className="min-w-0 flex-1">
                  {porCodigo ? (
                    <>
                      <div
                        className="font-mono text-[13px] font-bold"
                        style={{ color: "var(--text)" }}
                      >
                        {p.codigo ?? "—"}
                      </div>
                      <div
                        className="mt-0.5 text-[12px] leading-tight"
                        style={{
                          color: "var(--text-muted)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          wordBreak: "break-word",
                        }}
                      >
                        {p.nome}
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        className="text-[13px] font-semibold leading-tight"
                        style={{
                          color: "var(--text)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          wordBreak: "break-word",
                        }}
                      >
                        {p.nome}
                      </div>
                      {p.codigo && (
                        <div
                          className="mt-0.5 font-mono text-[10px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {p.codigo}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <span
                  className="chip shrink-0 whitespace-nowrap"
                  style={chipStyle}
                  title={`Saldo ${formatSaldo(p.saldo, p.unidade)} ${p.unidade}`}
                >
                  {formatSaldo(p.saldo, p.unidade)} {p.unidade}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
