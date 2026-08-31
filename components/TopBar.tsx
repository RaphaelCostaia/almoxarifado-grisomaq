"use client";

import clsx from "clsx";
import { useCurrentUserName } from "@/lib/user";

type Props = {
  q: string;
  onQ: (v: string) => void;
  frota: string;
  frotas: string[];
  onFrota: (v: string) => void;
  soUrgentes: boolean;
  onSoUrgentes: (v: boolean) => void;
  soAtraso: boolean;
  onSoAtraso: (v: boolean) => void;
  ocultarFinalizados: boolean;
  onOcultarFinalizados: (v: boolean) => void;
  onNovoPedido: () => void;
};

export function TopBar(p: Props) {
  const { nome } = useCurrentUserName();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-oliva-100 bg-creme-50 p-3 shadow-sm">
      <div className="relative min-w-[240px] flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-oliva-500">
          🔎
        </span>
        <input
          className="input-base pl-9"
          placeholder="Buscar por peça, frota ou solicitante…"
          value={p.q}
          onChange={(e) => p.onQ(e.target.value)}
        />
      </div>
      <select
        className="input-base max-w-[180px]"
        value={p.frota}
        onChange={(e) => p.onFrota(e.target.value)}
      >
        <option value="todas">Todas as frotas</option>
        {p.frotas.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <Toggle
        pressed={p.soUrgentes}
        onClick={() => p.onSoUrgentes(!p.soUrgentes)}
        tone="vermelho"
      >
        🔴 Urgentes
      </Toggle>
      <Toggle pressed={p.soAtraso} onClick={() => p.onSoAtraso(!p.soAtraso)} tone="amarelo">
        ⏱ Em atraso
      </Toggle>
      <Toggle
        pressed={p.ocultarFinalizados}
        onClick={() => p.onOcultarFinalizados(!p.ocultarFinalizados)}
      >
        Ocultar finalizados
      </Toggle>
      <div className="ml-auto flex items-center gap-2">
        <a href="/api/export" className="btn-secondary" title="Exportar CSV">
          ⬇ Exportar
        </a>
        <button
          className="btn-primary"
          onClick={p.onNovoPedido}
          title={`Registrar como ${nome}`}
        >
          + Novo pedido
        </button>
      </div>
    </div>
  );
}

function Toggle({
  pressed,
  onClick,
  tone,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  tone?: "vermelho" | "amarelo";
  children: React.ReactNode;
}) {
  const base =
    "inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-medium transition";
  const ativo =
    tone === "vermelho"
      ? "border-red-500 bg-red-50 text-red-700"
      : tone === "amarelo"
      ? "border-amber-500 bg-amber-50 text-amber-800"
      : "border-oliva-500 bg-oliva-50 text-oliva-900";
  const inativo =
    "border-oliva-100 bg-white text-oliva-800 hover:bg-oliva-50";
  return (
    <button className={clsx(base, pressed ? ativo : inativo)} onClick={onClick}>
      {children}
    </button>
  );
}
