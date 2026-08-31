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
        body: JSON.stringify({ nome, senha }),
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
      className="card-base w-full max-w-md rounded-xl p-6 shadow-2xl"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-oliva-600 text-2xl font-black text-white">
          G
        </div>
        <div>
          <div className="text-lg font-black" style={{ color: "var(--text)" }}>
            Fluxo de Peças
          </div>
          <div
            className="text-[11px] font-mono uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            GRISOMAQ
          </div>
        </div>
      </div>
      <p className="mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
        Entre com o usuário liberado pelo almoxarifado.
      </p>
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
      <label className="label-form mt-3" htmlFor="senha">
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
        <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {erro}
        </div>
      )}
      <button
        type="submit"
        className="btn-primary mt-4 w-full justify-center"
        disabled={entrando}
      >
        {entrando ? "Entrando…" : "Entrar"}
      </button>
      <p
        className="mt-3 text-center text-[11px]"
        style={{ color: "var(--text-muted)" }}
      >
        Esqueceu a senha? Fale com o administrador do almoxarifado.
      </p>
    </form>
  );
}
