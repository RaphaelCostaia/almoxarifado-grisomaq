"use client";

import { useSession } from "@/components/SessionProvider";

/**
 * Compatibilidade com componentes que ainda usam `useCurrentUserName`.
 * Agora o nome vem sempre da sessão do servidor (cookie assinado).
 */
export function useCurrentUserName() {
  const s = useSession();
  return {
    nome: s.nome,
    save: (_: string) => {
      // no-op: nome vem da sessão. Para trocar de usuário, deslogar e entrar de novo.
    },
  };
}
