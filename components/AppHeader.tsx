"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { ThemeToggle } from "./ThemeToggle";
import { useState } from "react";

type Tab = { href: string; label: string; adminOnly?: boolean };

const TABS: Tab[] = [
  { href: "/pedidos", label: "Pedidos" },
  { href: "/estoque", label: "Estoque" },
  { href: "/compras", label: "Compras" },
  { href: "/admin/usuarios", label: "Usuários", adminOnly: true },
];

type Props = {
  usuario: { nome: string; role: "admin" | "funcionario" };
};

export function AppHeader({ usuario }: Props) {
  const path = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const abas = TABS.filter((t) => !t.adminOnly || usuario.role === "admin");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header
      className="border-b"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-oliva-600 text-lg font-black text-creme-50 shadow-sm">
            G
          </div>
          <div className="leading-tight">
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
          <nav className="ml-6 flex items-center gap-1">
            {abas.map((t) => {
              const active = path?.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={clsx(
                    "rounded-md px-3 py-1.5 text-sm font-semibold transition"
                  )}
                  style={
                    active
                      ? { background: "var(--brand)", color: "#fff" }
                      : { color: "var(--text)" }
                  }
                >
                  {t.label}
                  {t.adminOnly && (
                    <span className="ml-1 text-[9px] opacity-60">ADM</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="relative">
            <button
              className="btn-secondary"
              onClick={() => setMenu((v) => !v)}
              title={usuario.role === "admin" ? "Administrador" : "Funcionário"}
            >
              <span
                className={clsx(
                  "inline-block h-2 w-2 rounded-full",
                  usuario.role === "admin" ? "bg-red-500" : "bg-emerald-500"
                )}
              />
              {usuario.nome}
              <span className="text-[10px] opacity-60">
                {usuario.role === "admin" ? "ADM" : "FUNC"}
              </span>
            </button>
            {menu && (
              <div
                className="absolute right-0 top-full z-40 mt-2 w-56 rounded-lg border p-2 shadow-xl"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <div
                  className="mb-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}
                >
                  Logado como
                </div>
                <div className="px-2 pb-2 text-sm font-semibold">
                  {usuario.nome}
                </div>
                <button
                  className="btn-ghost w-full justify-start"
                  onClick={logout}
                >
                  ↩ Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
