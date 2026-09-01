// Aplica constraints/índices via SQL puro, evitando prompts interativos
// do drizzle-kit. Rodar antes do `drizzle-kit push`.
import { sql } from "drizzle-orm";
import { db } from "./client";

async function main() {
  console.log("[constraints] Aplicando UNIQUE em pecas.codigo e pecas.nome…");

  // pecas.codigo unique — só se ainda não existir
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pecas_codigo_unique'
      ) THEN
        BEGIN
          ALTER TABLE pecas ADD CONSTRAINT pecas_codigo_unique UNIQUE (codigo);
          RAISE NOTICE 'Aplicado pecas_codigo_unique';
        EXCEPTION WHEN unique_violation THEN
          RAISE NOTICE 'Duplicatas em pecas.codigo — pule cleanup antes';
        END;
      END IF;
    END $$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pecas_nome_unique'
      ) THEN
        BEGIN
          ALTER TABLE pecas ADD CONSTRAINT pecas_nome_unique UNIQUE (nome);
          RAISE NOTICE 'Aplicado pecas_nome_unique';
        EXCEPTION WHEN unique_violation THEN
          RAISE NOTICE 'Duplicatas em pecas.nome — pule cleanup antes';
        END;
      END IF;
    END $$;
  `);

  console.log("[constraints] ✓ Concluído.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[constraints] ERRO:", err);
  process.exit(1);
});
