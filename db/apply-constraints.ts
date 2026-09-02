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

  // Aumenta motivo para 200 chars (era 64) — permite motivo "Outro" mais longo
  console.log("[constraints] Ajustando tamanho de pedidos.motivo pra 200…");
  await db.execute(sql`
    ALTER TABLE pedidos
    ALTER COLUMN motivo TYPE varchar(200);
  `);

  // Novos campos: código da peça, fabricante, modelo e ano do veículo
  console.log("[constraints] Adicionando novos campos em pedidos (codigo_peca, fabricante, modelo_veiculo, ano_veiculo)…");
  await db.execute(sql`
    ALTER TABLE pedidos
    ADD COLUMN IF NOT EXISTS codigo_peca varchar(64);
  `);
  await db.execute(sql`
    ALTER TABLE pedidos
    ADD COLUMN IF NOT EXISTS fabricante varchar(128);
  `);
  await db.execute(sql`
    ALTER TABLE pedidos
    ADD COLUMN IF NOT EXISTS modelo_veiculo varchar(128);
  `);
  await db.execute(sql`
    ALTER TABLE pedidos
    ADD COLUMN IF NOT EXISTS ano_veiculo varchar(16);
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

  // Ciclo comercial: condicao_pagamento em compras
  console.log("[constraints] Adicionando compras.condicao_pagamento (se faltar)…");
  await db.execute(sql`
    ALTER TABLE compras
    ADD COLUMN IF NOT EXISTS condicao_pagamento varchar(128);
  `);

  // Frotas cadastradas (importadas da planilha da GRISOMAQ)
  console.log("[constraints] Criando enum e tabela frotas (se faltar)…");
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'categoria_frota') THEN
        CREATE TYPE categoria_frota AS ENUM ('equipamento','implemento');
      END IF;
    END $$;
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS frotas (
      id SERIAL PRIMARY KEY,
      numero varchar(32) NOT NULL UNIQUE,
      categoria categoria_frota NOT NULL DEFAULT 'equipamento',
      modelo varchar(128),
      marca varchar(64),
      descricao varchar(128),
      ano varchar(8),
      placa varchar(16),
      chassi varchar(32),
      localizacao varchar(64),
      proprietario varchar(128),
      ativo integer NOT NULL DEFAULT 1,
      observacoes text,
      criado_em timestamp with time zone NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS frotas_numero_idx ON frotas (numero);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS frotas_modelo_idx ON frotas (modelo);
  `);

  console.log("[constraints] ✓ Concluído.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[constraints] ERRO:", err);
  process.exit(1);
});
