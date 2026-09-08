// Núcleo reutilizável da limpeza — chamado pelo script CLI (db/limpar-dados-teste.ts)
// e pelo endpoint HTTP admin (app/api/admin/system/limpar-teste/route.ts).
import { sql } from "drizzle-orm";
import { db } from "@/db/client-admin";

export type ContagensTabelas = {
  pedidos: number;
  compras: number;
  pedido_eventos: number;
  compra_eventos: number;
  movimentacoes: number;
  notificacoes: number;
  audit_log: number;
};

export type ContagensPreservadas = {
  frotas: number;
  pecas: number;
  usuarios: number;
};

export type ResultadoLimpeza = {
  ok: boolean;
  antes: ContagensTabelas;
  depois: ContagensTabelas;
  preservadosAntes: ContagensPreservadas;
  preservadosDepois: ContagensPreservadas;
  aviso?: string;
};

async function contar(tabela: string): Promise<number> {
  const r = await db.execute<{ c: number }>(
    sql.raw(`SELECT count(*)::int AS c FROM ${tabela}`)
  );
  return Number((r as any[])[0]?.c ?? 0);
}

export async function limparDadosTeste(): Promise<ResultadoLimpeza> {
  // Snapshot ANTES
  const antes: ContagensTabelas = {
    pedidos: await contar("pedidos"),
    compras: await contar("compras"),
    pedido_eventos: await contar("pedido_eventos"),
    compra_eventos: await contar("compra_eventos"),
    movimentacoes: await contar("movimentacoes"),
    notificacoes: await contar("notificacoes"),
    audit_log: await contar("audit_log"),
  };
  const preservadosAntes: ContagensPreservadas = {
    frotas: await contar("frotas"),
    pecas: await contar("pecas"),
    usuarios: await contar("usuarios"),
  };

  await db.transaction(async (tx) => {
    // Neutraliza os triggers de imutabilidade do audit_log dentro DESTA transação.
    // Só o owner pode fazer isso.
    await tx.execute(sql`SET LOCAL session_replication_role = replica`);

    // Ordem por FK (filhos antes dos pais)
    await tx.execute(sql`DELETE FROM notificacoes`);
    await tx.execute(sql`DELETE FROM movimentacoes`);
    await tx.execute(sql`DELETE FROM pedido_eventos`);
    await tx.execute(sql`DELETE FROM compra_eventos`);
    await tx.execute(sql`DELETE FROM compras`);
    await tx.execute(sql`DELETE FROM pedidos`);
    await tx.execute(sql`DELETE FROM audit_log`);

    // Reinicia sequências
    await tx.execute(sql`ALTER SEQUENCE pedidos_id_seq RESTART WITH 1`);
    await tx.execute(sql`ALTER SEQUENCE compras_id_seq RESTART WITH 1`);
    await tx.execute(sql`ALTER SEQUENCE pedido_eventos_id_seq RESTART WITH 1`);
    await tx.execute(sql`ALTER SEQUENCE compra_eventos_id_seq RESTART WITH 1`);
    await tx.execute(sql`ALTER SEQUENCE movimentacoes_id_seq RESTART WITH 1`);
    await tx.execute(sql`ALTER SEQUENCE notificacoes_id_seq RESTART WITH 1`);
    await tx.execute(sql`ALTER SEQUENCE audit_log_id_seq RESTART WITH 1`);

    // SET LOCAL some ao fim da transação — triggers voltam sozinhas
  });

  // Snapshot DEPOIS
  const depois: ContagensTabelas = {
    pedidos: await contar("pedidos"),
    compras: await contar("compras"),
    pedido_eventos: await contar("pedido_eventos"),
    compra_eventos: await contar("compra_eventos"),
    movimentacoes: await contar("movimentacoes"),
    notificacoes: await contar("notificacoes"),
    audit_log: await contar("audit_log"),
  };
  const preservadosDepois: ContagensPreservadas = {
    frotas: await contar("frotas"),
    pecas: await contar("pecas"),
    usuarios: await contar("usuarios"),
  };

  const mudouPreservado =
    preservadosAntes.frotas !== preservadosDepois.frotas ||
    preservadosAntes.pecas !== preservadosDepois.pecas ||
    preservadosAntes.usuarios !== preservadosDepois.usuarios;

  return {
    ok: !mudouPreservado,
    antes,
    depois,
    preservadosAntes,
    preservadosDepois,
    aviso: mudouPreservado
      ? "Contagem de tabela preservada mudou. Investigue."
      : undefined,
  };
}
