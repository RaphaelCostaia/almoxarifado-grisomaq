"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEntrando(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), senha }),
      });
      if (!res.ok) {
        setErro("Nome ou senha inválidos, ou usuário inativo.");
        setEntrando(false);
        return;
      }
      router.push("/pedidos");
      router.refresh();
    } catch {
      setErro("Falha de rede. Tente de novo.");
      setEntrando(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="card w-full max-w-sm p-7"
      style={{ boxShadow: "var(--shadow-md)" }}
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-xl font-black text-black">
          G
        </div>
        <div className="leading-tight">
          <div className="text-base font-bold tracking-tight">
            Fluxo de Peças
          </div>
          <div
            className="mt-0.5 font-mono text-[10px] font-medium uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            GRISOMAQ
          </div>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-2">
        <span className="live-dot" />
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--brand)" }}
        >
          Sistema em operação
        </span>
      </div>

      <label className="label-form" htmlFor="nome">
        Usuário
      </label>
      <input
        id="nome"
        autoFocus
        autoComplete="username"
        className="input-base"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        required
      />
      <label className="label-form mt-4" htmlFor="senha">
        Senha
      </label>
      <input
        id="senha"
        type="password"
        autoComplete="current-password"
        className="input-base"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        required
      />
      {erro && (
        <div
          className="mt-4 rounded-md border p-2.5 text-sm"
          style={{
            borderColor: "var(--danger-border)",
            background: "var(--danger-soft)",
            color: "var(--danger)",
          }}
        >
          {erro}
        </div>
      )}
      <button
        type="submit"
        className="btn-primary mt-5 w-full justify-center"
        disabled={entrando}
      >
        {entrando ? "Entrando…" : "Entrar →"}
      </button>
      <p
        className="mt-4 text-center text-[11px]"
        style={{ color: "var(--text-muted)" }}
      >
        Esqueceu a senha? Fale com o administrador do almoxarifado.
      </p>
    </form>
  );
}
