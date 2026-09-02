"use client";

import { useState } from "react";
import { Modal } from "./NovoPedidoDialog";
import type { Frota } from "@/db/schema";
import { ConfirmDialog } from "./PedidoDetalheDialog";

type Props = {
  frota: Frota | null; // null = nova, Frota = editar
  onClose: () => void;
  onSaved: () => void;
};

export function FrotaEditDialog({ frota, onClose, onSaved }: Props) {
  const nova = frota === null;

  const [numero, setNumero] = useState(frota?.numero ?? "");
  const [categoria, setCategoria] = useState<"equipamento" | "implemento">(
    frota?.categoria ?? "equipamento"
  );
  const [modelo, setModelo] = useState(frota?.modelo ?? "");
  const [marca, setMarca] = useState(frota?.marca ?? "");
  const [descricao, setDescricao] = useState(frota?.descricao ?? "");
  const [ano, setAno] = useState(frota?.ano ?? "");
  const [placa, setPlaca] = useState(frota?.placa ?? "");
  const [chassi, setChassi] = useState(frota?.chassi ?? "");
  const [localizacao, setLocalizacao] = useState(frota?.localizacao ?? "");
  const [proprietario, setProprietario] = useState(frota?.proprietario ?? "");
  const [ativo, setAtivo] = useState(frota?.ativo !== 0);
  const [observacoes, setObservacoes] = useState(frota?.observacoes ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmExcluir, setConfirmExcluir] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const body = {
      numero: numero.trim(),
      categoria,
      modelo: modelo.trim() || null,
      marca: marca.trim() || null,
      descricao: descricao.trim() || null,
      ano: ano.trim() || null,
      placa: placa.trim() || null,
      chassi: chassi.trim() || null,
      localizacao: localizacao.trim() || null,
      proprietario: proprietario.trim() || null,
      ativo,
      observacoes: observacoes.trim() || null,
    };
    const url = nova ? "/api/admin/frotas" : `/api/admin/frotas/${frota!.id}`;
    const method = nova ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSalvando(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErro(j.mensagem ?? j.error ?? "Falha ao salvar.");
      return;
    }
    onSaved();
  }

  return (
    <Modal
      onClose={onClose}
      tituloBadge={nova ? "Nova frota" : `Frota ${frota?.numero}`}
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label-form">Nº *</label>
            <input
              required
              className="input-base font-mono"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex: 95, 201"
              maxLength={32}
            />
          </div>
          <div className="col-span-2">
            <label className="label-form">Categoria</label>
            <div className="grid grid-cols-2 gap-2">
              {(["equipamento", "implemento"] as const).map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCategoria(c)}
                  className="rounded-md border px-3 py-2 text-sm font-semibold capitalize transition"
                  style={
                    categoria === c
                      ? {
                          background:
                            c === "implemento"
                              ? "var(--warning)"
                              : "var(--brand)",
                          borderColor:
                            c === "implemento"
                              ? "var(--warning)"
                              : "var(--brand)",
                          color: "#000",
                        }
                      : {
                          background: "var(--surface)",
                          borderColor: "var(--border)",
                          color: "var(--text-muted)",
                        }
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="label-form">Modelo</label>
          <input
            className="input-base"
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            placeholder="Ex: TOYOTA HILUX CD 4X4"
            maxLength={128}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label-form">Marca</label>
            <input
              className="input-base"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Ex: TOYOTA"
              maxLength={64}
            />
          </div>
          <div>
            <label className="label-form">Ano</label>
            <input
              className="input-base font-mono"
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              placeholder="2020"
              maxLength={8}
            />
          </div>
          <div>
            <label className="label-form">Placa</label>
            <input
              className="input-base font-mono uppercase"
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
              placeholder="ABC-1234"
              maxLength={16}
            />
          </div>
        </div>

        {categoria === "implemento" && (
          <div>
            <label className="label-form">Descrição do implemento</label>
            <input
              className="input-base"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: CARRETA 4 RODAS, TANQUE COMBUSTÍVEL"
              maxLength={128}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-form">Chassi</label>
            <input
              className="input-base font-mono"
              value={chassi}
              onChange={(e) => setChassi(e.target.value)}
              maxLength={32}
            />
          </div>
          <div>
            <label className="label-form">Localização</label>
            <input
              className="input-base"
              value={localizacao}
              onChange={(e) => setLocalizacao(e.target.value)}
              placeholder="Ex: 9-APOIO, Frente 15"
              maxLength={64}
            />
          </div>
        </div>

        <div>
          <label className="label-form">Proprietário</label>
          <input
            className="input-base"
            value={proprietario}
            onChange={(e) => setProprietario(e.target.value)}
            maxLength={128}
          />
        </div>

        <div>
          <label className="label-form">Status operacional</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAtivo(true)}
              className="rounded-md border px-3 py-2 text-sm font-semibold transition"
              style={
                ativo
                  ? {
                      background: "var(--brand)",
                      borderColor: "var(--brand)",
                      color: "#000",
                    }
                  : {
                      background: "var(--surface)",
                      borderColor: "var(--border)",
                      color: "var(--text-muted)",
                    }
              }
            >
              Em operação
            </button>
            <button
              type="button"
              onClick={() => setAtivo(false)}
              className="rounded-md border px-3 py-2 text-sm font-semibold transition"
              style={
                !ativo
                  ? {
                      background: "var(--text-muted)",
                      borderColor: "var(--text-muted)",
                      color: "#fff",
                    }
                  : {
                      background: "var(--surface)",
                      borderColor: "var(--border)",
                      color: "var(--text-muted)",
                    }
              }
            >
              Baixada
            </button>
          </div>
          <p
            className="mt-1 text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            Frotas baixadas não aparecem no autocomplete de novo pedido, mas
            continuam no histórico dos pedidos antigos.
          </p>
        </div>

        <div>
          <label className="label-form">Observações</label>
          <textarea
            rows={2}
            className="input-base"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>

        {erro && (
          <div
            className="rounded-md border p-2 text-sm"
            style={{
              borderColor: "var(--danger-border)",
              background: "var(--danger-soft)",
              color: "var(--danger)",
            }}
          >
            {erro}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          {!nova && (
            <button
              type="button"
              className="btn-ghost !text-[11px]"
              style={{ color: "var(--danger)" }}
              onClick={() => setConfirmExcluir(true)}
              title="Excluir a frota do cadastro"
            >
              🗑 Excluir
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn-primary" disabled={salvando}>
              {salvando ? "Salvando…" : nova ? "Cadastrar" : "Salvar"}
            </button>
          </div>
        </div>
      </form>

      {confirmExcluir && frota && (
        <ConfirmDialog
          titulo={`Excluir frota ${frota.numero}?`}
          descricao="Só é possível excluir se não houver pedidos vinculados. Se estiver saindo de operação, prefira 'Baixada' (mantém o histórico)."
          confirmar="Sim, excluir"
          tone="danger"
          onClose={() => setConfirmExcluir(false)}
          onConfirm={async () => {
            setConfirmExcluir(false);
            const res = await fetch(`/api/admin/frotas/${frota.id}`, {
              method: "DELETE",
            });
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              setErro(j.mensagem ?? "Falha ao excluir.");
              return;
            }
            onSaved();
          }}
        />
      )}
    </Modal>
  );
}
