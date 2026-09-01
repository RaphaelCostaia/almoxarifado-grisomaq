import { db } from "@/db/client";
import { notificacoes } from "@/db/schema";

type Args = {
  destinatario: string;
  autor: string; // pra não notificar quem fez a ação
  pedidoId?: number | null;
  texto: string;
};

/**
 * Cria uma notificação para o destinatário se ele não for o próprio autor
 * da ação. Falhas silenciosas — notificação nunca deve derrubar a mutação.
 */
export async function criarNotificacao(args: Args) {
  try {
    if (
      !args.destinatario ||
      args.destinatario.trim().toLowerCase() ===
        args.autor.trim().toLowerCase()
    ) {
      return;
    }
    await db.insert(notificacoes).values({
      destinatario: args.destinatario,
      pedidoId: args.pedidoId ?? null,
      texto: args.texto.slice(0, 500),
    });
  } catch (e) {
    console.error("[notificar] falhou:", e);
  }
}
