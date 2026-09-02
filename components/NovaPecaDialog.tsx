"use client";

import { useState } from "react";
import { Modal } from "./NovoPedidoDialog";
import clsx from "clsx";

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

export function NovaPecaDialog({ onClose, onCreated }: Props) {
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [saldo, setSaldo] = useState(0);
  const [minimo, setMinimo] = useState(0);
  const [maximo, setMaximo] = useState(0);
  const [localizacao, setLocalizacao] = useState("");
  const [familia, setFamilia] = useState("");
  const [codigoFabricante, setCodigoFabricante] = useState("");
  const [codigoParalelo, setCodigoParalelo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [camposComErro, setCamposComErro] = useState<string[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCamposComErro([]);
    setSalvando(true);
    try {
      const res = await fetch("/api/estoque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          codigo: codigo.trim() || null,
          unidade,
          saldo,
          minimo,
          maximo,
          localizacao: localizacao.trim() || null,
          familia: familia.trim() || null,
          codigoFabricante: codigoFabricante.trim() || null,
          codigoParalelo: codigoParalelo.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 409 && j.error === "peca_duplicada") {
          setErro(j.mensagem ?? "Peça duplicada.");
          setCamposComErro(j.campos ?? []);
          return;
        }
        throw new Error(j.mensagem ?? j.error ?? "Falha ao cadastrar peça");
      }
      onCreated();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const inputCls = (campo: string) =>
    clsx("input-base", camposComErro.includes(campo) && "!border-danger");

  return (
    <Modal onClose={onClose} tituloBadge="Cadastrar peça">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label-form">Nome da peça</label>
          <input
            required
            className="input-base"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Abraçadeira de mangueira 3/4"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-form">Código (opcional)</label>
            <input
              className={inputCls("codigo")}
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value);
                if (camposComErro.includes("codigo")) setCamposComErro([]);
              }}
              placeholder="Ex: MG-ABR-34"
              style={
                camposComErro.includes("codigo")
                  ? { borderColor: "var(--danger)" }
                  : undefined
              }
            />
            {camposComErro.includes("codigo") && (
              <div
                className="mt-1 text-[11px] font-semibold"
                style={{ color: "var(--danger)" }}
              >
                Código já usado em outra peça.
              </div>
            )}
          </div>
          <div>
            <label className="label-form">Unidade</label>
            <input
              required
              className="input-base"
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label-form">Saldo atual</label>
            <input
              type="number"
              min={0}
              className="input-base"
              value={saldo}
              onChange={(e) => setSaldo(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label-form">Mínimo</label>
            <input
              type="number"
              min={0}
              className="input-base"
              value={minimo}
              onChange={(e) => setMinimo(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label-form">Máximo</label>
            <input
              type="number"
              min={0}
              className="input-base"
              value={maximo}
              onChange={(e) => setMaximo(Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <label className="label-form">Localização</label>
          <input
            className="input-base"
            value={localizacao}
            onChange={(e) => setLocalizacao(e.target.value)}
            placeholder="Ex: Prateleira A2"
          />
        </div>
        <div>
          <label className="label-form">Família (opcional)</label>
          <input
            className="input-base"
            value={familia}
            onChange={(e) => setFamilia(e.target.value)}
            placeholder="Ex: HIDRAULICA, FERRAMENTAS, FILTROS"
            maxLength={64}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-form">Código fabricante</label>
            <input
              className="input-base font-mono"
              value={codigoFabricante}
              onChange={(e) => setCodigoFabricante(e.target.value)}
              placeholder="Ex: RE501020"
              maxLength={64}
            />
          </div>
          <div>
            <label className="label-form">Código paralelo</label>
            <input
              className="input-base font-mono"
              value={codigoParalelo}
              onChange={(e) => setCodigoParalelo(e.target.value)}
              maxLength={64}
            />
          </div>
        </div>
        {erro && camposComErro.length === 0 && (
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
        {erro && camposComErro.length > 0 && (
          <div
            className="rounded-md border p-2 text-sm"
            style={{
              borderColor: "var(--danger-border)",
              background: "var(--danger-soft)",
              color: "var(--danger)",
            }}
          >
            ⚠ {erro} O sistema não permite peças duplicadas — cada peça é
            controlada individualmente.
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={salvando}>
            {salvando ? "Salvando…" : "Cadastrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
