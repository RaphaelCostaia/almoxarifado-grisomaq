"use client";

import clsx from "clsx";

type Props = {
  q: string;
  onQ: (v: string) => void;
  frota: string;
  frotas: string[];
  onFrota: (v: string) => void;
  local: string;
  locais: string[];
  onLocal: (v: string) => void;
  soUrgentes: boolean;
  onSoUrgentes: (v: boolean) => void;
  soAtraso: boolean;
  onSoAtraso: (v: boolean) => void;
  ocultarFinalizados: boolean;
  onOcultarFinalizados: (v: boolean) => void;
  onNovoPedido: () => void;
};

export function TopBar(p: Props) {
  return (
    <div className="card flex flex-wrap items-center gap-2 p-2.5">
      <div className="relative min-w-[220px] flex-1">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          ⌕
        </span>
        <input
          className="input-base pl-8"
          placeholder="Buscar por peça, frota ou solicitante…"
          value={p.q}
          onChange={(e) => p.onQ(e.target.value)}
        />
      </div>
      <select
        className="input-base max-w-[160px]"
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
      <select
        className="input-base max-w-[160px]"
        value={p.local}
        onChange={(e) => p.onLocal(e.target.value)}
        title="Filtrar por local de trabalho"
      >
        <option value="todos">Todos os locais</option>
        {p.locais.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <Toggle
        pressed={p.soUrgentes}
        onClick={() => p.onSoUrgentes(!p.soUrgentes)}
        tone="danger"
      >
        <span className="live-dot !h-1.5 !w-1.5" style={{ background: "var(--danger)", boxShadow: "0 0 0 2px var(--danger-soft)" }} />
        Urgentes
      </Toggle>
      <Toggle
        pressed={p.soAtraso}
        onClick={() => p.onSoAtraso(!p.soAtraso)}
        tone="warning"
      >
        ◷ Em atraso
      </Toggle>
      <Toggle
        pressed={p.ocultarFinalizados}
        onClick={() => p.onOcultarFinalizados(!p.ocultarFinalizados)}
      >
        Ocultar finalizados
      </Toggle>
      <div className="ml-auto flex items-center gap-2">
        <a
          href="/api/export"
          className="btn-secondary !py-2 !text-xs"
          title="Exportar CSV"
        >
          ↓ CSV
        </a>
        <button className="btn-primary" onClick={p.onNovoPedido}>
          <span className="text-base leading-none">＋</span>
          Novo pedido
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
  tone?: "danger" | "warning";
  children: React.ReactNode;
}) {
  const style: React.CSSProperties = pressed
    ? tone === "danger"
      ? {
          background: "var(--danger-soft)",
          borderColor: "var(--danger-border)",
          color: "var(--danger)",
        }
      : tone === "warning"
      ? {
          background: "var(--warning-soft)",
          borderColor: "var(--warning-soft)",
          color: "var(--warning)",
        }
      : {
          background: "var(--brand-soft)",
          borderColor: "var(--brand-border)",
          color: "var(--brand)",
        }
    : {
        background: "var(--surface)",
        borderColor: "var(--border)",
        color: "var(--text-muted)",
      };
  return (
    <button
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition"
      )}
      style={style}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
