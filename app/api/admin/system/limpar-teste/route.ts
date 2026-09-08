import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exigirAdminApi } from "@/lib/api-auth";
import { limparDadosTeste } from "@/lib/limpar-dados-teste";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FRASE_CONFIRMACAO = "LIMPAR DADOS DE TESTE";

const Schema = z.object({
  confirmacao: z.string(),
});

export async function POST(req: NextRequest) {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "dados_invalidos" }, { status: 400 });
  }

  if (
    parsed.data.confirmacao.trim().toUpperCase() !==
    FRASE_CONFIRMACAO.toUpperCase()
  ) {
    return NextResponse.json(
      {
        error: "confirmacao_invalida",
        mensagem: `Digite exatamente "${FRASE_CONFIRMACAO}" pra confirmar.`,
      },
      { status: 400 }
    );
  }

  try {
    const resultado = await limparDadosTeste();
    return NextResponse.json(resultado);
  } catch (e: any) {
    console.error("[limpar-teste HTTP] erro:", e);
    return NextResponse.json(
      {
        error: "falha",
        mensagem:
          "Falha ao limpar. Provavelmente a role da app não tem permissão " +
          "de owner (SET session_replication_role). Configure POSTGRES_URL_ADMIN " +
          "no ambiente, ou rode via CLI: docker exec -it <container> npm run db:limpar-teste.",
        detalhe: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
