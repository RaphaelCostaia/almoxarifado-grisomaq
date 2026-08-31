import type { Metadata } from "next";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";
import { sessaoAtual } from "@/lib/auth";
import { ThemeInitScript } from "@/components/ThemeToggle";
import { SessionProvider } from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "Fluxo de Peças · GRISOMAQ",
  description:
    "Sistema de solicitação de peças e compras da GRISOMAQ — pedidos, estoque e compras em um só lugar.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await sessaoAtual();
  return (
    <html lang="pt-BR">
      <head>
        <ThemeInitScript />
      </head>
      <body className="min-h-screen font-sans antialiased">
        {sessao ? (
          <SessionProvider
            usuario={{ nome: sessao.nome, role: sessao.role }}
          >
            <AppHeader
              usuario={{ nome: sessao.nome, role: sessao.role }}
            />
            <main className="mx-auto w-full max-w-[1600px] px-4 pb-16 pt-4">
              {children}
            </main>
          </SessionProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
