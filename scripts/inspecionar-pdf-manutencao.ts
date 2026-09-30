// Inspeciona o texto bruto extraído do PDF de manutenção pelo pdf-parse v2.
import { readFileSync, writeFileSync } from "node:fs";

async function main() {
  const path = process.argv[2] || "C:/Users/User/Downloads/Relatorios_GMAIS_848.PDF.pdf";
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const buf = readFileSync(path);
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
    verbosity: 0,
    disableWorker: true,
  }).promise;
  const partes: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    partes.push((content.items as any[]).map((it) => it.str || "").join(" "));
    page.cleanup();
  }
  await doc.destroy().catch(() => {});
  const t = partes.join("\n");
  writeFileSync("scripts/texto-extraido.txt", t, "utf-8");
  const linhas = t.split(/\r?\n/);
  console.log(`Total de linhas: ${linhas.length}`);
  console.log(`\n=== 80 PRIMEIRAS LINHAS ===`);
  for (let i = 0; i < Math.min(80, linhas.length); i++) {
    console.log(`[${String(i).padStart(3)}] "${linhas[i]}"`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
