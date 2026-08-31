import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db/client";
import { usuarios, type Usuario } from "@/db/schema";

const COOKIE = "grisomaq_sess";
const SECRET_STR =
  process.env.AUTH_SECRET ??
  "dev-secret-mude-em-producao-grisomaq-almoxarifado-1234567890";
const SECRET = new TextEncoder().encode(SECRET_STR);

export type SessionPayload = {
  uid: number;
  nome: string;
  role: "admin" | "funcionario";
};

export async function assinarSessao(p: SessionPayload) {
  return await new SignJWT(p as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

export async function lerSessao(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function sessaoAtual(): Promise<SessionPayload | null> {
  const c = cookies().get(COOKIE)?.value;
  return await lerSessao(c);
}

export async function exigirSessao(): Promise<SessionPayload> {
  const s = await sessaoAtual();
  if (!s) redirect("/login");
  return s;
}

export async function exigirAdmin(): Promise<SessionPayload> {
  const s = await exigirSessao();
  if (s.role !== "admin") redirect("/pedidos");
  return s;
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE);
}

export async function autenticar(
  nome: string,
  senha: string
): Promise<Usuario | null> {
  const [u] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.nome, nome.trim()));
  if (!u || u.ativo !== 1) return null;
  const ok = await bcrypt.compare(senha, u.senhaHash);
  return ok ? u : null;
}

export async function hashSenha(s: string) {
  return await bcrypt.hash(s, 10);
}

export const SESSION_COOKIE_NAME = COOKIE;
