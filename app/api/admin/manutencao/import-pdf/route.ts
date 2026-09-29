// POST — recebe PDF do GMAIS, extrai texto, parseia, retorna preview.
// NÃO grava nada no banco — só devolve o preview pra tela mostrar antes
// de confirmar. A confirmação vai em /confirmar (outra rota).
import { NextRequest, NextResponse } from "next/server";
import { exigirAdminApi } from "@/lib/api-auth";
import { parsearTextoRelatorio } from "@/lib/parser-manutencao-gmais";
import { auditar } from "@/lib/auditar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// pdf-parse é CommonJS — importa via require pra evitar issues do
// arquivo "test data" no import path.
async function extrairTextoPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require("pdf-parse");
  const res = await pdfParse(buffer);
  return String(res.text || "");
}

export async function POST(req: NextRequest) {
  const auth = await exigirAdminApi();
  if (!auth.ok) return auth.res;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "sem_arquivo" }, { status: 400 });
  }
  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json(
      { error: "arquivo_muito_grande", limiteMb: 12 },
      { status: 413 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let texto = "";
  try {
    texto = await extrairTextoPdf(buf);
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "falha_parse_pdf",
        detalhe: String(e?.message ?? e),
      },
      { status: 400 }
    );
  }

  const resultado = parsearTextoRelatorio(texto);

  await auditar({
    req,
    sessao: auth.sessao,
    acao: "manutencao_import_pdf_preview",
    entidade: "manutencao",
    resumo: `Preview import PDF: ${resultado.registros.length} linhas, ${resultado.vencidos} vencidos`,
    diff: {
      arquivo: file.name,
      bytes: file.size,
      linhas: resultado.registros.length,
      frotas: resultado.frotasDistintas,
      vencidos: resultado.vencidos,
    },
  });

  return NextResponse.json(resultado);
}
