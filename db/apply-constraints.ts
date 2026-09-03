// Aplica constraints/índices/colunas via SQL puro, evitando prompts interativos
// do drizzle-kit. Rodar antes do `drizzle-kit push` no entrypoint.
import { sql } from "drizzle-orm";
import { db } from "./client-admin";

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

  // Peças (catálogo GMAIS): remove UNIQUE(nome) — 14k catálogo tem descrições repetidas,
  // troca saldo/minimo/maximo pra numeric(12,3) — combustível/óleo é fracionário,
  // adiciona familia, codigo_fabricante, codigo_paralelo.
  console.log("[constraints] Ajustando tabela pecas para catálogo GMAIS…");
  await db.execute(sql`
    ALTER TABLE pecas DROP CONSTRAINT IF EXISTS pecas_nome_unique;
  `);
  await db.execute(sql`
    DO $$
    BEGIN
      IF (SELECT data_type FROM information_schema.columns
           WHERE table_name='pecas' AND column_name='saldo') = 'integer' THEN
        ALTER TABLE pecas ALTER COLUMN saldo  TYPE numeric(12,3) USING saldo::numeric;
        ALTER TABLE pecas ALTER COLUMN minimo TYPE numeric(12,3) USING minimo::numeric;
        ALTER TABLE pecas ALTER COLUMN maximo TYPE numeric(12,3) USING maximo::numeric;
        RAISE NOTICE 'pecas.saldo/minimo/maximo convertidos para numeric(12,3)';
      END IF;
    END $$;
  `);
  await db.execute(sql`ALTER TABLE pecas ADD COLUMN IF NOT EXISTS familia varchar(64);`);
  await db.execute(sql`ALTER TABLE pecas ADD COLUMN IF NOT EXISTS codigo_fabricante varchar(64);`);
  await db.execute(sql`ALTER TABLE pecas ADD COLUMN IF NOT EXISTS codigo_paralelo varchar(64);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS pecas_familia_idx ON pecas (familia);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS pecas_codigo_fabricante_idx ON pecas (codigo_fabricante);`);

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

  // Trilha de auditoria imutável (hash-chain)
  console.log("[constraints] Criando tabela audit_log (se faltar)…");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY,
      ts timestamp with time zone NOT NULL DEFAULT now(),
      ator_uid integer,
      ator_nome varchar(64),
      ator_role varchar(16),
      ip varchar(64),
      user_agent varchar(512),
      acao varchar(64) NOT NULL,
      entidade varchar(32),
      entidade_id integer,
      resumo varchar(255) NOT NULL,
      diff jsonb,
      request_id varchar(40),
      hash_prev varchar(64) NOT NULL,
      hash_curr varchar(64) NOT NULL
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_log_ts_idx  ON audit_log (ts);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_log_ator_idx ON audit_log (ator_uid);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_log_ent_idx  ON audit_log (entidade, entidade_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_log_acao_idx ON audit_log (acao);`);

  // Imutabilidade no NÍVEL DO BANCO: trigger que bloqueia UPDATE e DELETE em audit_log,
  // independente da role/permissão. O owner (grisomaq) pode dar DROP TRIGGER pra
  // manutenção, mas isso quebra a hash-chain e é detectável.
  console.log("[constraints] Instalando trigger de imutabilidade em audit_log…");
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION audit_log_readonly() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'audit_log é append-only: % em %', TG_OP, TG_TABLE_NAME
        USING ERRCODE = 'insufficient_privilege';
    END;
    $$ LANGUAGE plpgsql;
  `);
  await db.execute(sql`DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;`);
  await db.execute(sql`
    CREATE TRIGGER audit_log_no_update
      BEFORE UPDATE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_log_readonly();
  `);
  await db.execute(sql`DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;`);
  await db.execute(sql`
    CREATE TRIGGER audit_log_no_delete
      BEFORE DELETE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_log_readonly();
  `);
  await db.execute(sql`DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log;`);
  await db.execute(sql`
    CREATE TRIGGER audit_log_no_truncate
      BEFORE TRUNCATE ON audit_log
      FOR EACH STATEMENT EXECUTE FUNCTION audit_log_readonly();
  `);

  // Opcional: cria role limitada `grisomaq_app` se APP_DB_PASSWORD for fornecida.
  // Isso permite ao operador migrar POSTGRES_URL da app pra usar essa role, dando
  // uma segunda camada de proteção (revoga DELETE geral). Se não fornecida, apenas
  // pula — a trigger acima já protege audit_log.
  const appPass = process.env.APP_DB_PASSWORD;
  if (appPass && appPass.length >= 8) {
    console.log("[constraints] Configurando role grisomaq_app (APP_DB_PASSWORD definida)…");
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='grisomaq_app') THEN
          EXECUTE format('CREATE ROLE grisomaq_app LOGIN PASSWORD %L', ${appPass});
        ELSE
          EXECUTE format('ALTER ROLE grisomaq_app WITH LOGIN PASSWORD %L', ${appPass});
        END IF;
      END $$;
    `);
    await db.execute(sql`GRANT USAGE ON SCHEMA public TO grisomaq_app;`);
    await db.execute(sql`GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO grisomaq_app;`);
    await db.execute(sql`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO grisomaq_app;`);
    // Bloqueio explícito em audit_log — só INSERT
    await db.execute(sql`REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM grisomaq_app;`);
    // Soft delete: remove DELETE em massa das tabelas de negócio (força usar deletado_em)
    await db.execute(sql`REVOKE DELETE ON pedidos, compras, pecas, frotas, usuarios FROM grisomaq_app;`);
  }

  // Soft delete em pedidos, compras, pecas, frotas, usuarios
  console.log("[constraints] Adicionando colunas de soft delete…");
  for (const tabela of ["pedidos", "compras", "pecas", "frotas", "usuarios"]) {
    await db.execute(
      sql.raw(
        `ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS deletado_em timestamp with time zone;`
      )
    );
    await db.execute(
      sql.raw(
        `ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS deletado_por varchar(64);`
      )
    );
    await db.execute(
      sql.raw(
        `CREATE INDEX IF NOT EXISTS ${tabela}_deletado_idx ON ${tabela} (deletado_em);`
      )
    );
  }

  console.log("[constraints] ✓ Concluído.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[constraints] ERRO:", err);
  process.exit(1);
});
