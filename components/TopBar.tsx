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
  de: string;
  ate: string;
  onDe: (v: string) => void;
  onAte: (v: string) => void;
  onNovoPedido: () => void;
};

function hojeISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function diasAtras(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function TopBar(p: Props) {
  const hoje = hojeISO();
  const d7 = diasAtras(6);
  const d30 = diasAtras(29);
  const ehHoje = p.de === hoje && p.ate === hoje;
  const eh7d = p.de === d7 && p.ate === hoje;
  const eh30d = p.de === d30 && p.ate === hoje;
  const temFiltroData = !!p.de || !!p.ate;

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

      {/* Filtro por data de criação */}
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1"
        style={{
          background: "var(--surface)",
          borderColor: temFiltroData ? "var(--brand-border)" : "var(--border)",
        }}
        title="Filtrar por data de criação"
      >
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          📅 Data
        </span>
        <button
          type="button"
          className="rounded px-2 py-0.5 text-[11px] font-semibold transition"
          onClick={() => {
            p.onDe(hoje);
            p.onAte(hoje);
          }}
          style={
            ehHoje
              ? {
                  background: "var(--brand-soft)",
                  color: "var(--brand)",
                }
              : { color: "var(--text-muted)" }
          }
        >
          Hoje
        </button>
        <button
          type="button"
          className="rounded px-2 py-0.5 text-[11px] font-semibold transition"
          onClick={() => {
            p.onDe(d7);
            p.onAte(hoje);
          }}
          style={
            eh7d
              ? {
                  background: "var(--brand-soft)",
                  color: "var(--brand)",
                }
              : { color: "var(--text-muted)" }
          }
        >
          7d
        </button>
        <button
          type="button"
          className="rounded px-2 py-0.5 text-[11px] font-semibold transition"
          onClick={() => {
            p.onDe(d30);
            p.onAte(hoje);
          }}
          style={
            eh30d
              ? {
                  background: "var(--brand-soft)",
                  color: "var(--brand)",
                }
              : { color: "var(--text-muted)" }
          }
        >
          30d
        </button>
        <input
          type="date"
          className="rounded border px-1.5 py-0.5 text-[11px]"
          style={{
            background: "var(--surface-2, transparent)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
          value={p.de}
          onChange={(e) => p.onDe(e.target.value)}
          title="De"
        />
        <span
          className="text-[10px]"
          style={{ color: "var(--text-muted)" }}
        >
          até
        </span>
        <input
          type="date"
          className="rounded border px-1.5 py-0.5 text-[11px]"
          style={{
            background: "var(--surface-2, transparent)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
          value={p.ate}
          onChange={(e) => p.onAte(e.target.value)}
          title="Até"
        />
        {temFiltroData && (
          <button
            type="button"
            className="rounded px-1.5 text-[13px] font-bold leading-none transition"
            style={{ color: "var(--text-muted)" }}
            onClick={() => {
              p.onDe("");
              p.onAte("");
            }}
            title="Limpar filtro de data"
          >
            ×
          </button>
        )}
      </div>

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
