"use client";

import { useState } from "react";
import useSWR from "swr";
import clsx from "clsx";
import { formatBR } from "@/lib/date";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Usuario = {
  id: number;
  nome: string;
  role: "admin" | "funcionario";
  ativo: number;
  criadoEm: string;
};

export function UsuariosLista() {
  const { data, mutate } = useSWR<{ usuarios: Usuario[] }>(
    "/api/admin/usuarios",
    fetcher,
    { refreshInterval: 6000 }
  );
  const [novoAberto, setNovoAberto] = useState(false);
  const [resetId, setResetId] = useState<number | null>(null);

  const users = data?.usuarios ?? [];

  async function toggleAtivo(u: Usuario) {
    await fetch(`/api/admin/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: u.ativo === 1 ? false : true }),
    });
    mutate();
  }

  async function trocarPapel(u: Usuario, novo: "admin" | "funcionario") {
    const res = await fetch(`/api/admin/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: novo }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(
        j.error === "nao_pode_rebaixar_a_si_mesmo"
          ? "Você não pode remover o próprio papel de admin. Peça pra outro admin fazer isso."
          : "Falha ao trocar papel."
      );
    }
    mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 shadow-sm card-base">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70">
            Administração
          </div>
          <h1 className="text-2xl font-black">Usuários</h1>
        </div>
        <button
          className="btn-primary ml-auto"
          onClick={() => setNovoAberto(true)}
        >
          + Novo usuário
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border card-base">
        <table className="w-full text-sm">
          <thead className="bg-oliva-800 text-creme-50">
            <tr>
              <Th>Nome</Th>
              <Th>Papel</Th>
              <Th>Status</Th>
              <Th>Criado</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2 font-semibold">{u.nome}</td>
                <td className="px-3 py-2">
                  <select
                    className="input-base max-w-[160px] py-1"
                    value={u.role}
                    onChange={(e) =>
                      trocarPapel(u, e.target.value as "admin" | "funcionario")
                    }
                  >
                    <option value="admin">Administrador</option>
                    <option value="funcionario">Funcionário</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={clsx(
                      "chip",
                      u.ativo === 1
                        ? "!bg-emerald-100 !text-emerald-800"
                        : "!bg-neutral-200 !text-neutral-700"
                    )}
                  >
                    {u.ativo === 1 ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs opacity-70">
                  {formatBR(u.criadoEm)}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => setResetId(u.id)}
                  >
                    Redefinir senha
                  </button>
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => toggleAtivo(u)}
                  >
                    {u.ativo === 1 ? "Desativar" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center opacity-60">
                  Nenhum usuário cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {novoAberto && (
        <NovoUsuarioDialog
          onClose={() => setNovoAberto(false)}
          onCreated={() => {
            setNovoAberto(false);
            mutate();
          }}
        />
      )}
      {resetId != null && (
        <ResetSenhaDialog
          userId={resetId}
          nome={users.find((u) => u.id === resetId)?.nome ?? ""}
          onClose={() => setResetId(null)}
        />
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest">
      {children}
    </th>
  );
}

function NovoUsuarioDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<"admin" | "funcionario">("funcionario");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, senha, role }),
    });
    setSalvando(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErro(
        j.error === "nome_ja_existe"
          ? "Já existe um usuário com esse nome."
          : "Falha ao cadastrar."
      );
      return;
    }
    onCreated();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-oliva-900/60 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border p-5 shadow-2xl card-base"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-lg font-black">Novo usuário</h3>
        <label className="label-form">Nome de login</label>
        <input
          required
          className="input-base"
          value={nome}
          onChange={(e) => setNome(e.target.value.trim())}
          placeholder="ex: matheus, joao, almox"
        />
        <label className="label-form mt-3">Senha inicial</label>
        <input
          required
          type="text"
          className="input-base font-mono"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="mínimo 6 caracteres"
          minLength={6}
        />
        <p className="mt-1 text-xs opacity-70">
          Anote e passe pro funcionário. Ele pode continuar usando ou pedir
          troca depois.
        </p>
        <label className="label-form mt-3">Papel</label>
        <select
          className="input-base"
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
        >
          <option value="funcionario">
            Funcionário — cria pedidos e acompanha
          </option>
          <option value="admin">
            Administrador — faz tudo (Kanban, estoque, compras, usuários)
          </option>
        </select>
        {erro && (
          <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {erro}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={salvando}>
            {salvando ? "Cadastrando…" : "Cadastrar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ResetSenhaDialog({
  userId,
  nome,
  onClose,
}: {
  userId: number;
  nome: string;
  onClose: () => void;
}) {
  const [senha, setSenha] = useState("");
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const res = await fetch(`/api/admin/usuarios/${userId}/senha`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha }),
    });
    setSalvando(false);
    if (res.ok) setOk(true);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-oliva-900/60 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border p-5 shadow-2xl card-base"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-lg font-black">Redefinir senha</h3>
        <p className="mb-3 text-sm opacity-80">
          Nova senha para <b>{nome}</b>. Passe pro usuário.
        </p>
        <input
          required
          type="text"
          className="input-base font-mono"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="mínimo 6 caracteres"
          minLength={6}
        />
        {ok && (
          <div className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-800">
            Senha redefinida. Anote e passe pro usuário.
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
          <button className="btn-primary" disabled={salvando}>
            {salvando ? "Salvando…" : "Redefinir"}
          </button>
        </div>
      </form>
    </div>
  );
}
