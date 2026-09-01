"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import type { Notificacao } from "@/db/schema";
import { formatBR } from "@/lib/date";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function NotificacoesSino() {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [ultimoId, setUltimoId] = useState<number>(0);

  const { data, mutate } = useSWR<{
    notificacoes: Notificacao[];
    naoLidas: number;
  }>("/api/notificacoes", fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
  });

  // Fecha ao clicar fora
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setAberto(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Dispara Notification API quando chega notificação nova
  useEffect(() => {
    const lista = data?.notificacoes ?? [];
    if (lista.length === 0) return;
    const maisRecente = Math.max(...lista.map((n) => n.id));
    if (ultimoId === 0) {
      setUltimoId(maisRecente);
      return;
    }
    if (maisRecente > ultimoId) {
      const novas = lista.filter((n) => n.id > ultimoId && n.lida === 0);
      setUltimoId(maisRecente);
      try {
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          for (const n of novas.slice(0, 3)) {
            new Notification("🔔 Fluxo de Peças", {
              body: n.texto,
              tag: `notif-${n.id}`,
              icon: "/favicon.svg",
            });
          }
        }
      } catch {}
    }
  }, [data, ultimoId]);

  const naoLidas = data?.naoLidas ?? 0;
  const lista = data?.notificacoes ?? [];

  async function marcarLida(id: number) {
    await fetch("/api/notificacoes/marcar-lida", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutate();
  }

  async function marcarTodas() {
    await fetch("/api/notificacoes/marcar-lida", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ todas: true }),
    });
    mutate();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn-secondary relative !px-2.5 !py-2"
        onClick={() => setAberto((v) => !v)}
        aria-label="Notificações"
        title={`${naoLidas} nova(s)`}
      >
        <span className="text-base leading-none">🔔</span>
        {naoLidas > 0 && (
          <span
            className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold"
            style={{ background: "var(--danger)", color: "#fff" }}
          >
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </button>
      {aberto && (
        <div
          className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-lg border shadow-xl"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="flex items-center justify-between border-b px-3 py-2"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="font-mono text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              Notificações
            </div>
            {naoLidas > 0 && (
              <button
                className="btn-ghost !text-[10px]"
                onClick={marcarTodas}
              >
                marcar todas como lidas
              </button>
            )}
          </div>
          <div
            className="dense-scroll max-h-[400px] overflow-y-auto"
          >
            {lista.length === 0 && (
              <div
                className="p-6 text-center text-sm"
                style={{ color: "var(--text-dim)" }}
              >
                Nenhuma notificação por aqui.
              </div>
            )}
            {lista.map((n) => (
              <button
                key={n.id}
                className="w-full border-b px-3 py-2.5 text-left transition"
                style={{
                  borderColor: "var(--border)",
                  background:
                    n.lida === 0 ? "var(--brand-soft)" : "transparent",
                }}
                onClick={() => {
                  marcarLida(n.id);
                  setAberto(false);
                  // Navegação simples pro pedido, se houver
                  if (n.pedidoId) {
                    window.location.href = "/pedidos";
                  }
                }}
              >
                <div
                  className="text-sm leading-snug"
                  style={{ color: "var(--text)" }}
                >
                  {n.texto}
                </div>
                <div
                  className="mt-1 font-mono text-[10px] tabular-nums"
                  style={{ color: "var(--text-muted)" }}
                >
                  {formatBR(n.criadoEm)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
