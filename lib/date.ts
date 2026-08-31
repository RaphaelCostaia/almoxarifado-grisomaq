import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatBR(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM HH:mm", { locale: ptBR });
}

export function formatBRDia(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

export function diasDesde(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
