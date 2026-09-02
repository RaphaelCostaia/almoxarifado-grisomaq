"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import type { Frota } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Props = {
  valor: string;
  onValor: (v: string) => void;
  onFrota?: (f: Frota | null) => void;
  placeholder?: string;
  required?: boolean;
};

export function FrotaAutocomplete({
  valor,
  onValor,
  onFrota,
  placeholder = "Digite número, modelo ou placa…",
  required,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [foco, setFoco] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  const q = valor.trim();
  const { data } = useSWR<{ frotas: Frota[] }>(
    q.length >= 1 ? `/api/frotas?q=${encodeURIComponent(q)}&limit=10` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setAberto(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const opcoes = data?.frotas ?? [];

  return (
    <div className="relative" ref={ref}>
      <input
        className="input-base"
        placeholder={placeholder}
        value={valor}
        required={required}
        onChange={(e) => {
          onValor(e.target.value);
          if (onFrota) onFrota(null);
          setAberto(true);
        }}
        onFocus={() => valor && setAberto(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setAberto(true);
            setFoco((f) => Math.min(opcoes.length - 1, f + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setFoco((f) => Math.max(0, f - 1));
          } else if (e.key === "Enter" && aberto && foco >= 0 && opcoes[foco]) {
            e.preventDefault();
            const f = opcoes[foco];
            onValor(f.numero);
            if (onFrota) onFrota(f);
            setAberto(false);
            setFoco(-1);
          } else if (e.key === "Escape") {
            setAberto(false);
          }
        }}
      />
      {aberto && opcoes.length > 0 && (
        <div
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border shadow-lg"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="border-b px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-muted)",
            }}
          >
            Frotas cadastradas
          </div>
          {opcoes.map((f, i) => {
            const linha1 =
              f.categoria === "implemento" && f.descricao
                ? `${f.marca ?? ""} ${f.descricao}`.trim()
                : f.modelo ?? "";
            return (
              <button
                type="button"
                key={f.id}
                onMouseEnter={() => setFoco(i)}
                onClick={() => {
                  onValor(f.numero);
                  if (onFrota) onFrota(f);
                  setAberto(false);
                  setFoco(-1);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition"
                style={{
                  background:
                    foco === i ? "var(--surface-3)" : "transparent",
                }}
              >
                <span
                  className="min-w-[45px] rounded px-1.5 py-0.5 text-center font-mono text-[11px] font-bold"
                  style={{
                    background:
                      f.categoria === "implemento"
                        ? "var(--warning-soft)"
                        : "var(--brand-soft)",
                    color:
                      f.categoria === "implemento"
                        ? "var(--warning)"
                        : "var(--brand)",
                  }}
                >
                  {f.numero}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-sm font-semibold"
                    style={{ color: "var(--text)" }}
                  >
                    {linha1 || "(sem modelo)"}
                  </div>
                  <div
                    className="truncate font-mono text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {[
                      f.placa,
                      f.ano,
                      f.categoria === "implemento" ? "implemento" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {valor && opcoes.length === 0 && q.length >= 1 && aberto && (
        <div
          className="absolute z-30 mt-1 w-full rounded-md border p-2 text-[11px] shadow-lg"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          Nenhuma frota cadastrada com "{q}". Você pode digitar assim mesmo
          (texto livre).
        </div>
      )}
    </div>
  );
}
