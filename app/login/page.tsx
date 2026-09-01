import { LoginForm } from "@/components/LoginForm";
import { sessaoAtual } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const s = await sessaoAtual();
  if (s) redirect("/pedidos");
  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="relative w-full max-w-sm">
        {/* Grid de fundo pra dar aquele ar industrial */}
        <div
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 70%)",
          }}
        />
        <LoginForm />
      </div>
    </div>
  );
}
