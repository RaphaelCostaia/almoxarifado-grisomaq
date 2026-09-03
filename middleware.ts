import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ??
    "dev-secret-mude-em-producao-grisomaq-almoxarifado-1234567890"
);

const ROTAS_PUBLICAS = ["/login", "/api/auth/login"];

function garantirRequestId(req: NextRequest): string {
  const existente = req.headers.get("x-request-id");
  if (existente && existente.length >= 8 && existente.length <= 40) {
    return existente;
  }
  // uuid v4 sem hifens (32 chars) — cabe no varchar(40) do audit_log
  return crypto.randomUUID();
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const requestId = garantirRequestId(req);

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon") ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("grisomaq_sess")?.value;
  let sessao: { uid: number; nome: string; role: "admin" | "funcionario" } | null =
    null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      sessao = payload as any;
    } catch {
      sessao = null;
    }
  }

  const publica = ROTAS_PUBLICAS.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );

  if (!sessao && !publica) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // 401 para XHR/API, redirect para navegações
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "nao_autenticado" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(url);
  }

  // /admin e /dashboard só para admin
  if (
    sessao &&
    (pathname.startsWith("/admin") || pathname.startsWith("/dashboard")) &&
    sessao.role !== "admin"
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/pedidos";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Propaga x-request-id pra rotas (usado pelo audit_log)
  const headers = new Headers(req.headers);
  headers.set("x-request-id", requestId);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
