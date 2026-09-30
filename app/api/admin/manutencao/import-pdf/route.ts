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

// pdfjs-dist legacy build — 100% JavaScript puro, sem dependência nativa
// (canvas, Cairo, Pango). Roda em Node.js Alpine sem problema.
// Extrai só o texto (getTextContent), não renderiza imagens.
async function extrairTextoPdf(buffer: Buffer): Promise<string> {
  // Import dinâmico do build legacy CommonJS
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Aponta pro worker do próprio pacote (arquivo .mjs empacotado). O legacy
  // build funciona bem com esse caminho absoluto (via require.resolve).
  if (pdfjs.GlobalWorkerOptions) {
    try {
      // require.resolve dá o caminho real do worker no filesystem em runtime.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const req = eval("require") as NodeRequire;
      pdfjs.GlobalWorkerOptions.workerSrc = req.resolve(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
      );
    } catch {
      /* segue sem worker se falhar */
    }
  }
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
    verbosity: 0,
    // isEvalSupported=false + disableWorker=true força pdfjs a rodar tudo
    // na thread principal (mais lento mas sem worker file loading issues)
    disableWorker: true,
  });
  const doc = await loadingTask.promise;
  const partes: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // Ordena todos os itens da página por Y desc, depois X asc — reconstrói
      // a ordem visual. Junta tudo numa string por página; o parser vai
      // segmentar por regex de compartimento.
      const itens = (content.items as any[])
        .filter((it) => it && typeof it.str === "string" && it.transform)
        .map((it) => ({
          x: it.transform[4] as number,
          y: it.transform[5] as number,
          str: it.str as string,
        }))
        .sort((a, b) => (b.y - a.y) * 1000 + (a.x - b.x));
      partes.push(itens.map((t) => t.str).join(" "));
      page.cleanup();
    }
  } finally {
    try {
      await doc.destroy();
    } catch {
      /* ignore */
    }
  }
  return partes.join("\n");
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
