"use client";

import { createContext, useContext } from "react";

export type SessionUser = {
  nome: string;
  role: "admin" | "funcionario";
};

const Ctx = createContext<SessionUser>({
  nome: "",
  role: "funcionario",
});

export function SessionProvider({
  usuario,
  children,
}: {
  usuario: SessionUser;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={usuario}>{children}</Ctx.Provider>;
}

export function useSession() {
  return useContext(Ctx);
}

export function useIsAdmin() {
  return useContext(Ctx).role === "admin";
}
