/**
 * Converte string monetária no formato brasileiro (100,00 · 1.234,56)
 * ou americano (100.00 · 1234.56) para número.
 * Retorna null se não for um número válido.
 */
export function parseMoney(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const limpo = String(v).trim();
  if (!limpo) return null;
  // Se tem vírgula, assume formato BR: remove pontos (separadores de milhar) e troca vírgula por ponto
  // Se só tem ponto, assume formato US e usa como está
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
