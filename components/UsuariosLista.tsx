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
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div>
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Administração
          </div>
          <h1 className="text-xl font-bold tracking-tight">Usuários</h1>
        </div>
        <button
          className="btn-primary ml-auto"
          onClick={() => setNovoAberto(true)}
        >
          <span className="text-base leading-none">＋</span>
          Novo usuário
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b"
              style={{
                background: "var(--surface-3)",
                borderColor: "var(--border)",
              }}
            >
              <Th>Nome</Th>
              <Th>Papel</Th>
              <Th>Status</Th>
              <Th>Criado</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <td className="px-3 py-2.5">
                  <div className="font-semibold">{u.nome}</div>
                </td>
                <td className="px-3 py-2.5">
                  <select
                    className="input-base max-w-[180px] !py-1 !text-xs"
                    value={u.role}
                    onChange={(e) =>
                      trocarPapel(
                        u,
                        e.target.value as "admin" | "funcionario"
                      )
                    }
                  >
                    <option value="admin">Administrador</option>
                    <option value="funcionario">Funcionário</option>
                  </select>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={clsx(
                      "chip",
                      u.ativo === 1 ? "chip-brand" : ""
                    )}
                  >
                    {u.ativo === 1 ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td
                  className="px-3 py-2.5 font-mono text-[11px] tabular-nums"
                  style={{ color: "var(--text-muted)" }}
                >
                  {formatBR(u.criadoEm)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      className="btn-ghost"
                      onClick={() => setResetId(u.id)}
                    >
                      Nova senha
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => toggleAtivo(u)}
                    >
                      {u.ativo === 1 ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-10 text-center"
                  style={{ color: "var(--text-dim)" }}
                >
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
    <th
      className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-widest"
      style={{ color: "var(--text-muted)" }}
    >
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
      className="fixed inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="card w-full max-w-md p-5"
        style={{ boxShadow: "var(--shadow-md)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-bold tracking-tight">Novo usuário</h3>
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
        <p
          className="mt-1 text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          Anote e passe pro funcionário.
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
            Administrador — faz tudo
          </option>
        </select>
        {erro && (
          <div
            className="mt-3 rounded-md border p-2 text-sm"
            style={{
              borderColor: "var(--danger-border)",
              background: "var(--danger-soft)",
              color: "var(--danger)",
            }}
          >
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
      className="fixed inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="card w-full max-w-md p-5"
        style={{ boxShadow: "var(--shadow-md)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-lg font-bold tracking-tight">
          Redefinir senha
        </h3>
        <p
          className="mb-3 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          Nova senha para <b style={{ color: "var(--text)" }}>{nome}</b>.
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
          <div
            className="mt-3 rounded-md border p-2 text-sm"
            style={{
              borderColor: "var(--brand-border)",
              background: "var(--brand-soft)",
              color: "var(--brand)",
            }}
          >
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
