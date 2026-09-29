// Parser do relatório PDF "Posição Lubrificação/Manutenção/Garantias da Frota"
// exportado do GMAIS pela GRISOMAQ.
//
// O layout do relatório tem colunas de largura fixa; cada frota abre uma
// seção que se estende por várias linhas (uma linha por compartimento).
// A primeira linha da frota tem: <n>{modelo} <cod-comp>-<tipo> <últ_data> …
// As linhas subsequentes só têm dados de compartimento.
//
// Nunca lançamos exceção pro caller — se uma linha não bater no regex, é
// ignorada silenciosamente (o relatório tem headers e rodapés variados).

export type LinhaManutencao = {
  frotaNumero: string;
  frotaModelo: string | null;
  compartimentoCodigo: string;
  compartimentoTipo: string;
  ultimaTrocaData: string | null;
  ultimaTrocaHodometro: string | null;
  kmIntervalo: string | null;
  hodometroAtual: string | null;
  kmFaltando: string | null;
  diasFaltando: string | null;
  pecaCodigo: string | null;
  pecaNome: string | null;
  capacidade: string | null;
  vencido: boolean;
};

// Regex de compartimento com tolerância a campos ausentes.
// Estrutura:
//   NN-TIPO ...  [DD/MM/AAAA]  [hodômetro anterior]  km_intervalo
//   hodômetro_acum  falta_p_troca  [*]  [dias]  peca_cod-peca_nome  capacidade
const REGEX_COMP =
  /^(\d+)-([A-Z0-9/\.\s]+?)\s+(?:(\d{2}\/\d{2}\/\d{4})\s+)?(?:(\d[\d\.\,]*)\s+)?(\d[\d\.\,]*)\s+(\d[\d\.\,]*)\s+(-?\d[\d\.\,]*)\s+(?:(\*)\s+)?(?:(\d+)\s+)?(\d+)-(.+?)\s+([\d\.\,]+)\s*$/;

// Regex de linha "cabeçalho de frota" — começa com dígito colado a texto
// maiúsculo. O primeiro compartimento vem no fim da mesma linha.
const REGEX_FROTA_HEAD = /^(\d+)([A-Z][A-Z0-9 \/\-\.]+?)\s+(\d+-.+)$/;

// Linhas de header/rodapé que devem ser puladas
const REGEX_HEADER_LINE =
  /(GRISOLINO|FAZENDA|ORINDIUVA|Posi.+o Lubrifica|COMPARTIMENTO|F R O T A|TIPO DE GARANTIA|P.gina\s+N)/i;

function parseLinhaCompartimento(
  linha: string,
  frotaNumero: string,
  frotaModelo: string | null
): LinhaManutencao | null {
  const m = REGEX_COMP.exec(linha);
  if (!m) return null;
  const falta = m[7];
  const marcador = m[8];
  const vencido = marcador === "*" || falta.startsWith("-");
  return {
    frotaNumero,
    frotaModelo,
    compartimentoCodigo: m[1],
    compartimentoTipo: m[2].trim(),
    ultimaTrocaData: m[3] || null,
    ultimaTrocaHodometro: m[4] || null,
    kmIntervalo: m[5] || null,
    hodometroAtual: m[6] || null,
    kmFaltando: falta || null,
    diasFaltando: m[9] || null,
    pecaCodigo: m[10] || null,
    pecaNome: (m[11] || "").trim() || null,
    capacidade: m[12] || null,
    vencido,
  };
}

/**
 * Recebe o TEXTO completo extraído do PDF (por qualquer engine) e devolve
 * a lista de compartimentos parseados.
 */
export function parsearTextoRelatorio(texto: string): {
  registros: LinhaManutencao[];
  frotasDistintas: number;
  vencidos: number;
} {
  const registros: LinhaManutencao[] = [];
  let frotaAtual: string | null = null;
  let modeloAtual: string | null = null;

  const linhas = texto.split(/\r?\n/);
  for (const raw of linhas) {
    const linha = raw.trim();
    if (!linha) continue;
    if (REGEX_HEADER_LINE.test(linha)) continue;

    // Linha começa com nova frota?
    const mFrota = REGEX_FROTA_HEAD.exec(linha);
    if (mFrota) {
      frotaAtual = mFrota[1];
      // Separa modelo do 1º compartimento
      const resto = (mFrota[2].trim() + " " + mFrota[3]).trim();
      const mSep = /^(.+?)\s+(\d+-[A-Z0-9\/\.\s].+)$/.exec(resto);
      if (mSep) {
        modeloAtual = mSep[1].trim();
        const reg = parseLinhaCompartimento(
          mSep[2],
          frotaAtual,
          modeloAtual
        );
        if (reg) registros.push(reg);
      } else {
        modeloAtual = null;
      }
      continue;
    }

    // Linha de compartimento continuando a frota atual
    if (frotaAtual) {
      const reg = parseLinhaCompartimento(linha, frotaAtual, modeloAtual);
      if (reg) registros.push(reg);
    }
  }

  const frotas = new Set(registros.map((r) => r.frotaNumero));
  const vencidos = registros.filter((r) => r.vencido).length;
  return {
    registros,
    frotasDistintas: frotas.size,
    vencidos,
  };
}
