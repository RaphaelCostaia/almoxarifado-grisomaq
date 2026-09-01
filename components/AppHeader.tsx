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
      className="sticky top-0 z-30 border-b backdrop-blur-md"
      style={{
        background: "var(--bg)",
        borderColor: "var(--border)",
      }}
    >
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-6">
          <Link href="/pedidos" className="group flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-lg font-black text-black shadow-sm">
              G
            </div>
            <div className="leading-none">
              <div
                className="text-[15px] font-bold tracking-tight"
                style={{ color: "var(--text)" }}
              >
                Fluxo de Peças
              </div>
              <div
                className="mt-1 font-mono text-[10px] font-medium uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}
              >
                GRISOMAQ
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-0.5">
            {abas.map((t) => {
              const active = path?.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className="tab-link"
                  data-active={active}
                >
                  {t.label}
                  {t.adminOnly && (
                    <span className="ml-1.5 font-mono text-[8px] uppercase tracking-widest opacity-60">
                      adm
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="hidden items-center gap-2 rounded-md border px-2.5 py-1.5 md:flex"
            style={{
              borderColor: "var(--brand-border)",
              background: "var(--brand-soft)",
            }}
          >
            <span className="live-dot" />
            <span
              className="font-mono text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--brand)" }}
            >
              ao vivo
            </span>
          </div>
          <ThemeToggle />
          <div className="relative">
            <button
              className="btn-secondary !gap-2.5"
              onClick={() => setMenu((v) => !v)}
              title={usuario.role === "admin" ? "Administrador" : "Funcionário"}
            >
              <span
                className={clsx(
                  "inline-block h-2 w-2 rounded-full",
                  usuario.role === "admin" ? "bg-danger" : "bg-brand"
                )}
              />
              <span className="text-sm">{usuario.nome}</span>
              <span
                className="font-mono text-[9px] font-bold uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}
              >
                {usuario.role === "admin" ? "adm" : "func"}
              </span>
            </button>
            {menu && (
              <div
                className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-lg border shadow-xl"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="border-b px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
                  <div
                    className="text-[9px] font-semibold uppercase tracking-widest"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Logado como
                  </div>
                  <div className="mt-0.5 text-sm font-bold">{usuario.nome}</div>
                </div>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium transition hover:opacity-80"
                  style={{ color: "var(--danger)" }}
                  onClick={logout}
                >
                  <span>↩</span>
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
