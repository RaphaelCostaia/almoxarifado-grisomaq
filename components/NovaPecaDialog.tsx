"use client";

import { useState } from "react";
import { Modal } from "./NovoPedidoDialog";

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
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/estoque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          codigo: codigo || null,
          unidade,
          saldo,
          minimo,
          maximo,
          localizacao: localizacao || null,
        }),
      });
      if (!res.ok) throw new Error("Falha ao cadastrar peça");
      onCreated();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

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
              className="input-base"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ex: MG-ABR-34"
            />
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
        {erro && (
          <div className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {erro}
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
