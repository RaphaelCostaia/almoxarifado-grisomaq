// Roda: `npm run db:cleanup`
// Remove peças e pedidos duplicados que o seed antigo criou antes das constraints.
import { sql } from "drizzle-orm";
import { db } from "./client-admin";

async function main() {
  console.log("[cleanup] Removendo peças duplicadas por código…");
  const pecasRm = await db.execute(sql`
    DELETE FROM pecas
    WHERE id NOT IN (
      SELECT MIN(id) FROM pecas
      WHERE codigo IS NOT NULL
      GROUP BY codigo
    )
    AND codigo IS NOT NULL
    RETURNING id
  `);
  console.log(`[cleanup] → ${(pecasRm as any).length ?? 0} peças duplicadas removidas.`);

  console.log("[cleanup] Removendo pedidos duplicados (mesma frota+descrição+solicitante criados no mesmo minuto)…");
  const pedidosRm = await db.execute(sql`
    DELETE FROM pedidos
    WHERE id NOT IN (
      SELECT MIN(id) FROM pedidos
      GROUP BY frota, descricao, solicitante, date_trunc('minute', criado_em)
    )
    RETURNING id
  `);
  console.log(`[cleanup] → ${(pedidosRm as any).length ?? 0} pedidos duplicados removidos.`);

  console.log("[cleanup] ✓ Concluído.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[cleanup] ERRO:", err);
  process.exit(1);
});
