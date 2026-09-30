// Inspeciona o texto bruto extraído do PDF de manutenção pelo pdf-parse v2.
import { readFileSync, writeFileSync } from "node:fs";

async function main() {
  const path = process.argv[2] || "C:/Users/User/Downloads/Relatorios_GMAIS_848.PDF.pdf";
  const mod: any = await import("pdf-parse");
  const PDFParse = mod.PDFParse ?? mod.default?.PDFParse;
  const buf = readFileSync(path);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const res = await parser.getText();
  await parser.destroy().catch(() => {});
  const t = String(res?.text ?? "");
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
