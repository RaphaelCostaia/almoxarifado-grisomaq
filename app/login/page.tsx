import { LoginForm } from "@/components/LoginForm";
import { sessaoAtual } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const s = await sessaoAtual();
  if (s) redirect("/pedidos");
  return (
    <div className="flex min-h-screen items-center justify-center bg-oliva-800 p-4">
      <LoginForm />
    </div>
  );
}
