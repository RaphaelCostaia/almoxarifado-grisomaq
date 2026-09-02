// Formatação de saldo/quantidade para peças. O schema guarda saldo como numeric(12,3),
// então drizzle retorna string. Unidades fracionárias (líquidos, peso, comprimento)
// mostram até 3 casas decimais; contáveis mostram inteiro.

const UNIDADES_FRACIONARIAS = new Set([
  "LT", "L", "ML", "M3", "GL", "KG", "MT", "PA", "BR",
]);

export function ehFracionaria(unidade?: string | null): boolean {
  if (!unidade) return false;
  return UNIDADES_FRACIONARIAS.has(unidade.trim().toUpperCase());
}

export function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function formatSaldo(
  v: number | string | null | undefined,
  unidade?: string | null
): string {
  const n = toNum(v);
  if (ehFracionaria(unidade)) {
    return n.toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
  }
  // Contáveis: arredonda pra baixo, sem casas
  return Math.floor(n).toLocaleString("pt-BR");
}
