// Parser do relatório PDF "Posição Lubrificação/Manutenção/Garantias da Frota"
// exportado do GMAIS pela GRISOMAQ.
//
// O pdf-parse (baseado em pdfjs) não preserva a ordem visual das colunas —
// tokens de uma mesma linha podem aparecer fora de posição. Por isso o
// parser é baseado em EXTRAÇÃO DE TOKENS heurística em cada linha:
//   - captura padrões conhecidos independente da posição
//   - decide o papel de cada número pelo contexto
//
// Nunca lançamos exceção pro caller — linhas não reconhecidas são ignoradas
// silenciosamente (o relatório tem cabeçalhos e rodapés que precisam ser
// filtrados).

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

// ---------------- padrões ----------------

// Compartimento: número curto (1-3 dígitos) + hífen + letra(s). Ex: "1-CARTER",
// "14-CAIXA DE TRAÇÃO", "68-FILTRO A/C INTERNO". Comprimento razoável limita
// falsos positivos.
const REGEX_COMPARTIMENTO = /\b(\d{1,3})-([A-ZÀ-Ú][A-ZÀ-Ú0-9/\.\s]{2,40}?)(?=\s{2,}|\s+\d|\s*$|\t)/;

// Peça: mesmo padrão mas com nome mais longo — geralmente OLEO, FILTRO, etc.
// Palavras-chave típicas ajudam a distinguir de compartimento. Nome mínimo 6
// chars pra evitar colisão.
const REGEX_PECA =
  /\b(\d{2,6})-((?:OLEO|FILTRO|CORREIA|GRAXA|FLUIDO|LIQUIDO|LUBRIF|COMBUS|RACOR|SINT|MINERAL)[A-Z0-9/\.\s\-]{2,50}?)(?=\s{2,}|\s+\d|\s*$|\t)/i;

const REGEX_DATA = /\b(\d{2}\/\d{2}\/\d{4})\b/;
const REGEX_VENCIDO = /\*/;
// Números com casas decimais (.NNN ou ,N) — hodômetros / km / capacidades.
// Aceita negativo pra km_faltando.
const REGEX_NUMEROS = /-?\d[\d\.]{0,15}(?:,\d{1,3})?/g;

// Linhas de cabeçalho/rodapé pra ignorar
const REGEX_LIXO =
  /^(GRISOLINO|FAZENDA|ORINDIUVA|Posi.+o Lubrific|COMPARTIMENTO|F\s?R\s?O\s?T\s?A|TIPO DE GARANTIA|ÚLTIMA TROCA|HOD[OÔ]M|DATA P\/TROCA|DIAS|FALT|ÓLEO RECOMENDADO|MAX|CAPAC|--\s*\d+ of \d+|Página|\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2})\s*$/i;

// ---------------- helpers ----------------

function limparToken(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function extrairTodosNumeros(linha: string): string[] {
  const encontrados: string[] = [];
  const re = new RegExp(REGEX_NUMEROS.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(linha)) !== null) {
    encontrados.push(m[0]);
  }
  return encontrados;
}

function extrairData(linha: string): string | null {
  const m = REGEX_DATA.exec(linha);
  return m ? m[1] : null;
}

/**
 * Tenta identificar o modelo + número da frota. Aparece só no primeiro
 * compartimento (`1-CARTER` ou o primeiro listado) de cada frota, em 2
 * formatos observados:
 *
 *   a) "...NUM MARCA MODELO 01/09/2026 ..." (número da frota antes do modelo,
 *      logo depois do bloco de compartimento). Ex.:
 *      "1-CARTER 1 TOYOTA HILUX CD 4X4 FO 01/09/2026 ..."
 *
 *   b) "...MARCA MODELO NUM 9,00" (número da frota no fim, antes da
 *      capacidade). Ex.: "...OLEO SHELL 436.000 TOYOTA HILUX FO 1 9,00"
 *
 * Retorna [modelo, numeroFrota] ou null se não reconhecer.
 */
function extrairFrotaInline(linha: string): { modelo: string; numero: string } | null {
  // Formato observado: depois de "NN-TIPO", vem "MODELO NUM_FROTA DATA ..."
  // Ex.: "1-CARTER TOYOTA HILUX CD 4X4 FO 1 01/09/2026 426.000 ..."
  //      "1-CARTER MB SPRINTER 416-CDI FBT 26 03/09/2026 ..."
  // Estratégia: extrai o texto entre o compartimento e o próximo NÚMERO
  // seguido de DATA. Esse texto é "MODELO NUM_FROTA".
  const semComp = linha.replace(
    /^\d{1,3}-[A-ZÀ-Ú][A-ZÀ-Ú0-9/\.\s]{2,40}?\s+/,
    "",
  );
  // Captura "MODELO NUM" antes de "DATA" (dd/mm/aaaa)
  const m = /^([A-ZÀ-Ú][A-ZÀ-Ú0-9\s\-/\.]{2,60}?)\s+(\d{1,5})\s+\d{2}\/\d{2}\/\d{4}/.exec(
    semComp,
  );
  if (m) {
    const modelo = limparToken(m[1]);
    const numero = m[2];
    if (
      !/^(OLEO|FILTRO|CORREIA|GRAXA|FLUIDO|LIQUIDO|LUBRIF|COMBUS|RACOR|SINT|SEMI|MINERAL|SHELL|SAE|API|GL|MB|HD|CT)/i.test(
        modelo,
      )
    ) {
      return { modelo, numero };
    }
  }
  return null;
}

/**
 * Parse de uma única linha, se reconhecida como linha de compartimento.
 * `frotaInline` é setada quando essa linha é a PRIMEIRA da frota (tem
 * modelo+número junto). Nos demais casos, o consumidor propaga a última
 * frota vista.
 */
function parseLinha(linha: string): {
  registro: Omit<LinhaManutencao, "frotaNumero" | "frotaModelo"> | null;
  frotaInline: { modelo: string; numero: string } | null;
} {
  const norm = linha.replace(/\t+/g, " ").replace(/\s+/g, " ").trim();
  if (!norm || REGEX_LIXO.test(norm)) {
    return { registro: null, frotaInline: null };
  }

  // Uma linha de compartimento tem AO MENOS: 1 comp + 1 peça (ou só comp) +
  // 3 números. Detecta compartimento; se não achar, ignora.
  const mComp = REGEX_COMPARTIMENTO.exec(norm);
  if (!mComp) return { registro: null, frotaInline: null };

  const compCodigo = mComp[1];
  const compTipo = limparToken(mComp[2]);

  // Extrai peça REMOVENDO primeiro a substring do compartimento — evita casar
  // com o próprio compartimento quando ele começa com "FILTRO"/"OLEO" (ex.:
  // "37-FILTRO COMBUSTIVEL" também casaria com REGEX_PECA senão).
  let pecaCodigo: string | null = null;
  let pecaNome: string | null = null;
  const normSemComp =
    norm.slice(0, mComp.index) + " " + norm.slice(mComp.index + mComp[0].length);
  const mPeca = REGEX_PECA.exec(normSemComp);
  if (mPeca) {
    pecaCodigo = mPeca[1];
    pecaNome = limparToken(mPeca[2]);
  }

  const data = extrairData(linha);
  const vencido = REGEX_VENCIDO.test(norm);
  const numeros = extrairTodosNumeros(norm);

  // Estratégia:
  //   - km_faltando: menor número em módulo? não. É o que tem sinal (se
  //     vencido) OU um dos números que NÃO é hodômetro cheio.
  //   - hodometro_atual: número maior repetido em todas as linhas da mesma
  //     frota — mas aqui parseamos linha a linha; heurística: número que
  //     tem "," (parte decimal) é geralmente o hodôm_acum.
  //   - km_intervalo: número redondo pequeno (10.000, 20.000, 30.000,
  //     40.000, 50.000, 80.000).
  //   - hodometro_ultima_troca: número inteiro logo antes/depois da data.
  //   - capacidade: último número da linha, com casa decimal pequena (0,00 a 20,00).

  // Números "com vírgula" — geralmente hodômetro atual e falta p/troca
  const comVirgula = numeros.filter((n) => n.includes(","));
  // Números inteiros redondos típicos de intervalo
  const intervalosTipicos = ["10.000", "20.000", "30.000", "40.000", "50.000", "60.000", "80.000", "100.000"];
  const kmIntervalo =
    numeros.find((n) => intervalosTipicos.includes(n)) ?? null;

  // km_faltando: negativo => vencido; senão o valor com vírgula que não é
  // o hodômetro_atual.
  let kmFaltando: string | null = null;
  const negativo = numeros.find((n) => n.startsWith("-"));
  if (negativo) {
    kmFaltando = negativo;
  } else {
    // pega o menor dos "com vírgula" (o hodôm atual é o maior)
    if (comVirgula.length >= 2) {
      const ordenados = [...comVirgula].sort(
        (a, b) => parseNumeroBR(a) - parseNumeroBR(b)
      );
      kmFaltando = ordenados[0];
    } else if (comVirgula.length === 1) {
      kmFaltando = comVirgula[0];
    }
  }

  // hodometro_atual: maior número com vírgula
  let hodometroAtual: string | null = null;
  if (comVirgula.length > 0) {
    hodometroAtual = comVirgula.reduce((a, b) =>
      parseNumeroBR(a) > parseNumeroBR(b) ? a : b
    );
  }

  // ultimaTrocaHodometro: número inteiro sem casas decimais, MAIOR (>10000)
  // geralmente. Fica próximo da data.
  let ultimaTrocaHodometro: string | null = null;
  const inteirosGrandes = numeros.filter(
    (n) => !n.includes(",") && !n.startsWith("-") && parseNumeroBR(n) >= 1000
  );
  if (inteirosGrandes.length > 0) {
    // O km_intervalo já foi excluído; pega o restante
    const candidatos = inteirosGrandes.filter((n) => n !== kmIntervalo);
    if (candidatos.length > 0) {
      // O primeiro geralmente é o hodôm da última troca
      ultimaTrocaHodometro = candidatos[0];
    }
  }

  // Dias faltando: número inteiro pequeno (1-9999) que não é hodôm nem intervalo
  let diasFaltando: string | null = null;
  const inteirosPequenos = numeros.filter(
    (n) => !n.includes(",") && !n.startsWith("-") && parseNumeroBR(n) < 1000 && parseNumeroBR(n) >= 10
  );
  const diasCandidatos = inteirosPequenos.filter((n) => n !== kmIntervalo);
  if (diasCandidatos.length > 0) {
    diasFaltando = diasCandidatos[0];
  }

  // Capacidade: último número pequeno com vírgula e uma casa decimal (ex.: 9,00)
  let capacidade: string | null = null;
  for (let i = numeros.length - 1; i >= 0; i--) {
    const n = numeros[i];
    if (n.includes(",") && parseNumeroBR(n) < 100 && n !== hodometroAtual) {
      capacidade = n;
      break;
    }
  }

  const frotaInline = extrairFrotaInline(linha);

  return {
    registro: {
      compartimentoCodigo: compCodigo,
      compartimentoTipo: compTipo,
      ultimaTrocaData: data,
      ultimaTrocaHodometro,
      kmIntervalo,
      hodometroAtual,
      kmFaltando,
      diasFaltando,
      pecaCodigo,
      pecaNome,
      capacidade,
      vencido,
    },
    frotaInline,
  };
}

function parseNumeroBR(s: string): number {
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// ---------------- API pública ----------------

export function parsearTextoRelatorio(texto: string): {
  registros: LinhaManutencao[];
  frotasDistintas: number;
  vencidos: number;
} {
  const registros: LinhaManutencao[] = [];
  let frotaAtual: string | null = null;
  let modeloAtual: string | null = null;

  // Divide o texto (que agora pode ser 1 string por página) em blocos —
  // cada bloco começa com padrão " NN-TIPO" (compartimento).
  const blocos = texto
    .split(/(?=\s\d{1,3}-[A-ZÀ-Ú])/)
    .map((s) => s.trim())
    .filter((s) => /^\d{1,3}-[A-ZÀ-Ú]/.test(s));

  for (const bloco of blocos) {
    const { registro, frotaInline } = parseLinha(bloco);
    if (frotaInline) {
      frotaAtual = frotaInline.numero;
      modeloAtual = frotaInline.modelo;
    }
    if (registro && frotaAtual) {
      registros.push({
        frotaNumero: frotaAtual,
        frotaModelo: modeloAtual,
        ...registro,
      });
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
