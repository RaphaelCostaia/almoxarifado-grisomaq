"use client";

import { useState } from "react";
import { ManutencaoRelatorioGmais } from "./ManutencaoRelatorioGmais";
import { ManutencaoKanban } from "./ManutencaoKanban";

type Aba = "relatorio" | "kanban";

export function ManutencaoPainel() {
  const [aba, setAba] = useState<Aba>("kanban");

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div>
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Administração
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            Manutenção da Frota
          </h1>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Importe o PDF do GMAIS pra ter os dados na tela; programe as
            trocas pra oficina executar.
          </p>
        </div>
        <div className="ml-auto flex gap-1 rounded-lg border p-1" style={{ borderColor: "var(--border)" }}>
          <button
            className="tab-link"
            data-active={aba === "kanban"}
            onClick={() => setAba("kanban")}
          >
            🔧 Kanban Oficina
          </button>
          <button
            className="tab-link"
            data-active={aba === "relatorio"}
            onClick={() => setAba("relatorio")}
          >
            📄 Relatório GMAIS
          </button>
        </div>
      </div>

      {aba === "kanban" ? <ManutencaoKanban /> : <ManutencaoRelatorioGmais />}
    </div>
  );
}
