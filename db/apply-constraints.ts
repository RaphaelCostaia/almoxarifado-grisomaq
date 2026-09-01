// Aplica constraints/índices/colunas via SQL puro, evitando prompts interativos
// do drizzle-kit. Rodar antes do `drizzle-kit push` no entrypoint.
import { sql } from "drizzle-orm";
import { db } from "./client";

async function main() {
  console.log("[constraints] Aplicando UNIQUE em pecas.codigo e pecas.nome…");

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

  // Novo: coluna local em pedidos + índice
  console.log("[constraints] Adicionando coluna pedidos.local (se faltar)…");
  await db.execute(sql`
    ALTER TABLE pedidos
    ADD COLUMN IF NOT EXISTS local varchar(64);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS pedidos_local_idx ON pedidos (local);
  `);

  // Novo: tabela notificacoes
  console.log("[constraints] Criando tabela notificacoes (se faltar)…");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS notificacoes (
      id SERIAL PRIMARY KEY,
      destinatario varchar(64) NOT NULL,
      pedido_id integer REFERENCES pedidos(id) ON DELETE CASCADE,
      texto text NOT NULL,
      lida integer NOT NULL DEFAULT 0,
      criado_em timestamp with time zone NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS notificacoes_dest_idx
    ON notificacoes (destinatario, lida);
  `);

  console.log("[constraints] ✓ Concluído.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[constraints] ERRO:", err);
  process.exit(1);
});
