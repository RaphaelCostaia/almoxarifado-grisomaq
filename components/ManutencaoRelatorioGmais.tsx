"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import type { ManutencaoRegistroGmais } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Resumo = {
  total: number;
  vencidos: number;
  frotas: number;
  importadoEm: string | null;
};

type LinhaParseada = {
  frotaNumero: string;
  frotaModelo: string | null;
  compartimentoCodigo: string;
  compartimentoTipo: string;
  ultimaTrocaData: string | null;
  ultimaTrocaHodometro: string | null;
  kmIntervalo: string | null;
  hodometroAtual: string | null;
  kmFaltando: string | null;
  diasFaltando: string | null;
  pecaCodigo: string | null;
  pecaNome: string | null;
  capacidade: string | null;
  vencido: boolean;
};

export function ManutencaoRelatorioGmais() {
  const [q, setQ] = useState("");
  const [frotaFiltro, setFrotaFiltro] = useState("");
  const [soVencidos, setSoVencidos] = useState(false);
  const [preview, setPreview] = useState<{
    registros: LinhaParseada[];
    frotasDistintas: number;
    vencidos: number;
  } | null>(null);
  const [importando, setImportando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (frotaFiltro) params.set("frota", frotaFiltro);
  if (soVencidos) params.set("soVencidos", "1");

  const { data, mutate } = useSWR<{
    registros: ManutencaoRegistroGmais[];
    resumo: Resumo;
  }>(`/api/admin/manutencao/registros?${params}`, fetcher, {
    refreshInterval: 15000,
  });

  const rows = data?.registros ?? [];
  const r = data?.resumo ?? { total: 0, vencidos: 0, frotas: 0, importadoEm: null };

  async function enviarArquivo(f: File) {
    setErro(null);
    setPreview(null);
    setImportando(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/admin/manutencao/import-pdf", {
        method: "POST",
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) {
        setErro(j.mensagem ?? j.error ?? "Falha ao ler PDF");
        return;
      }
      setPreview(j);
    } catch (e: any) {
      setErro(e?.message ?? "Falha ao ler PDF");
    } finally {
      setImportando(false);
    }
  }

  async function confirmarImport() {
    if (!preview) return;
    setConfirmando(true);
    setErro(null);
    try {
      const res = await fetch("/api/admin/manutencao/import-pdf/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registros: preview.registros }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErro(j.mensagem ?? j.error ?? "Falha ao gravar");
        return;
      }
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      await mutate();
    } finally {
      setConfirmando(false);
    }
  }

  async function programarTroca(reg: ManutencaoRegistroGmais) {
    const ok = window.confirm(
      `Programar OS pra oficina?\n\nFrota ${reg.frotaNumero} — ${reg.compartimentoTipo}\nPeça: ${reg.pecaCodigo ?? "—"} ${reg.pecaNome ?? ""}`
    );
    if (!ok) return;
    const res = await fetch("/api/admin/manutencao/ordens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        frotaNumero: reg.frotaNumero,
        frotaModelo: reg.frotaModelo,
        compartimentoCodigo: reg.compartimentoCodigo,
        compartimentoTipo: reg.compartimentoTipo,
        pecaCodigo: reg.pecaCodigo,
        pecaDescricao: reg.pecaNome,
        quantidade: reg.capacidade
          ? Number(String(reg.capacidade).replace(",", ".")) || 1
          : 1,
      }),
    });
    if (res.ok) {
      alert(`OS criada. Veja no Kanban Oficina.`);
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.mensagem ?? j.error ?? "Falha ao criar OS");
    }
  }

  return (
    <div className="space-y-4">
      {/* Importador */}
      <div className="card p-4">
        <div className="mb-2 font-semibold">📥 Importar PDF do GMAIS</div>
        <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
          Selecione o PDF "Posição Lubrificação/Manutenção/Garantias" exportado
          do GMAIS. O sistema lê o arquivo e mostra um preview antes de gravar.
          Reimportar substitui o snapshot anterior — não duplica.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="input-base"
            style={{ maxWidth: 380 }}
            disabled={importando}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) enviarArquivo(f);
            }}
          />
          {importando && (
            <span
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Lendo PDF…
            </span>
          )}
          {r.importadoEm && !preview && (
            <span
              className="ml-auto text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Último import: {new Date(r.importadoEm).toLocaleString("pt-BR")}
            </span>
          )}
        </div>

        {erro && (
          <div
            className="mt-3 rounded-md border p-2 text-xs"
            style={{
              borderColor: "var(--danger-border)",
              background: "var(--danger-soft)",
              color: "var(--danger)",
            }}
          >
            {erro}
          </div>
        )}

        {preview && (
          <div
            className="mt-3 rounded-md border p-3 text-sm"
            style={{
              borderColor: "var(--brand-border)",
              background: "var(--brand-soft)",
              color: "var(--text)",
            }}
          >
            <div>
              <b>Preview:</b> {preview.registros.length} linhas em{" "}
              {preview.frotasDistintas} frotas.{" "}
              <span style={{ color: "var(--danger)" }}>
                {preview.vencidos} marcadas como vencidas
              </span>{" "}
              (segundo o GMAIS).
            </div>
            <div className="mt-2 flex gap-2">
              <button
                className="btn-primary"
                onClick={confirmarImport}
                disabled={confirmando}
              >
                {confirmando ? "Gravando…" : "✓ Confirmar e gravar"}
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setPreview(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                disabled={confirmando}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2">
        <Res n={r.total} label="Linhas no snapshot" />
        <Res n={r.frotas} label="Frotas" tone="brand" />
        <Res n={r.vencidos} label="Vencidas no GMAIS" tone={r.vencidos > 0 ? "danger" : undefined} />
      </div>

      {/* Filtros */}
      <div className="card flex flex-wrap items-center gap-2 p-2.5">
        <input
          className="input-base flex-1"
          style={{ minWidth: 240 }}
          placeholder="Buscar frota, compartimento, peça, código…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="input-base"
          style={{ maxWidth: 140 }}
          placeholder="Frota nº"
          value={frotaFiltro}
          onChange={(e) => setFrotaFiltro(e.target.value)}
        />
        <button
          className="tab-link"
          data-active={soVencidos}
          onClick={() => setSoVencidos((v) => !v)}
        >
          🔴 Só vencidas
        </button>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b"
                style={{
                  background: "var(--surface-3)",
                  borderColor: "var(--border)",
                }}
              >
                <Th>Frota</Th>
                <Th>Compartimento</Th>
                <Th>Última troca</Th>
                <Th>KM p/troca</Th>
                <Th>KM atual</Th>
                <Th className="text-right">Falta</Th>
                <Th>Peça</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t"
                  style={{
                    borderColor: "var(--border)",
                    background:
                      row.vencido === 1 ? "var(--danger-soft)" : "transparent",
                  }}
                >
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs font-bold">
                      {row.frotaNumero}
                    </div>
                    {row.frotaModelo && (
                      <div
                        className="text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {row.frotaModelo}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-mono text-[11px]">
                      {row.compartimentoCodigo}
                    </div>
                    <div className="text-xs">{row.compartimentoTipo}</div>
                  </td>
                  <td
                    className="px-3 py-2 text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <div>{row.ultimaTrocaData ?? "—"}</div>
                    <div className="font-mono">
                      {row.ultimaTrocaHodometro ?? ""}
                    </div>
                  </td>
                  <td
                    className="px-3 py-2 font-mono text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {row.kmIntervalo ?? "—"}
                  </td>
                  <td
                    className="px-3 py-2 font-mono text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {row.hodometroAtual ?? "—"}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-mono text-xs font-bold"
                    style={{
                      color:
                        row.vencido === 1 ? "var(--danger)" : "var(--text)",
                    }}
                  >
                    {row.kmFaltando ?? "—"}
                    {row.vencido === 1 && " *"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-mono text-[11px]">
                      {row.pecaCodigo ?? "—"}
                    </div>
                    <div
                      className="text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {row.pecaNome ?? ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="btn-primary !py-1 !text-[11px]"
                      onClick={() => programarTroca(row)}
                    >
                      + Programar
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-xs"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {r.total === 0
                      ? "Nenhum snapshot importado ainda. Suba o PDF do GMAIS acima."
                      : "Sem resultado pra esse filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-widest ${className ?? ""}`}
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </th>
  );
}

function Res({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone?: "brand" | "danger";
}) {
  const color =
    tone === "brand"
      ? "var(--brand)"
      : tone === "danger"
      ? "var(--danger)"
      : "var(--text)";
  return (
    <div className="card px-3.5 py-3">
      <div
        className="font-mono text-2xl font-black leading-none tabular-nums"
        style={{ color }}
      >
        {n}
      </div>
      <div
        className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
    </div>
  );
}
