// Teste do parser com o PDF real do cliente.
// Rodar: npx tsx scripts/testar-parser-manutencao.ts <caminho-pdf>
import { readFileSync } from "node:fs";
import { parsearTextoRelatorio } from "../lib/parser-manutencao-gmais";

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
    const linhasMap = new Map<number, { x: number; str: string }[]>();
    for (const it of content.items as any[]) {
      if (!it || typeof it.str !== "string") continue;
      const t = it.transform as number[] | undefined;
      if (!t || t.length < 6) continue;
      const y = Math.round(t[5]);
      const bucket = linhasMap.get(y) ?? [];
      bucket.push({ x: t[4], str: it.str });
      linhasMap.set(y, bucket);
    }
    const ys = Array.from(linhasMap.keys()).sort((a, b) => b - a);
    for (const y of ys) {
      partes.push(
        linhasMap
          .get(y)!
          .sort((a, b) => a.x - b.x)
          .map((t) => t.str)
          .join(" "),
      );
    }
    page.cleanup();
  }
  await doc.destroy().catch(() => {});
  const texto = partes.join("\n");
  console.log(`Bytes: ${buf.length}, chars: ${texto.length}`);

  const r = parsearTextoRelatorio(texto);
  console.log(`\n=== RESUMO ===`);
  console.log(`  Registros: ${r.registros.length}`);
  console.log(`  Frotas distintas: ${r.frotasDistintas}`);
  console.log(`  Vencidos: ${r.vencidos}`);

  const frotasSet = new Set(r.registros.map(x => x.frotaNumero));
  const frotasOrdenadas = Array.from(frotasSet).map(Number).sort((a, b) => a - b);
  console.log(`  Faixa de frotas: ${frotasOrdenadas[0]} até ${frotasOrdenadas.at(-1)}`);

  console.log(`\n=== VENCIDOS ===`);
  for (const x of r.registros.filter(y => y.vencido)) {
    console.log(
      `  Frota ${x.frotaNumero.padStart(4)} | ${x.compartimentoCodigo.padStart(2)}-${x.compartimentoTipo.padEnd(25)} | ` +
      `falta ${(x.kmFaltando || "?").padStart(10)} km | peça ${(x.pecaCodigo || "?").padStart(5)} ${(x.pecaNome || "").slice(0, 30)}`
    );
  }

  // Verifica que campos obrigatórios não são null em nenhum registro
  const problemas = r.registros.filter(x =>
    !x.frotaNumero || !x.compartimentoCodigo || !x.compartimentoTipo
  );
  console.log(`\nRegistros com campos obrigatórios vazios: ${problemas.length}`);

  // Verifica cobertura por frota (algumas frotas podem ter só 1 registro?)
  const contagemPorFrota = new Map<string, number>();
  for (const x of r.registros) {
    contagemPorFrota.set(x.frotaNumero, (contagemPorFrota.get(x.frotaNumero) || 0) + 1);
  }
  const distribuicao = Array.from(contagemPorFrota.values());
  console.log(`\nRegistros por frota: min=${Math.min(...distribuicao)}, max=${Math.max(...distribuicao)}, média=${(distribuicao.reduce((a,b)=>a+b,0)/distribuicao.length).toFixed(1)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
