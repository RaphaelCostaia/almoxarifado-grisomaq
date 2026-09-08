// Zera os dados transacionais de teste ANTES de subir em produção.
// PRESERVA: usuarios, frotas, pecas, /data/uploads.
// APAGA:   pedidos, compras, pedido_eventos, compra_eventos,
//          movimentacoes, notificacoes, audit_log.
// Reinicia as sequências de ID pra 1 (produção começa bonita).
//
// Rodar UMA vez, direto no servidor:
//   docker exec -it <container-app> npm run db:limpar-teste
// Ou localmente com .env.local apontando pro Postgres do EasyPanel:
//   npm run db:limpar-teste
//
// Requer role owner (client-admin). A trigger de imutabilidade do audit_log
// bloqueia DELETE/TRUNCATE — o script desativa temporariamente via
// `SET session_replication_role = replica`, que é o mecanismo padrão do
// Postgres pra bulk operations administrativas.
import { sql } from "drizzle-orm";
import { db } from "./client-admin";

async function contar(tabela: string): Promise<number> {
  const r = await db.execute<{ c: number }>(
    sql.raw(`SELECT count(*)::int AS c FROM ${tabela}`)
  );
  return Number((r as any[])[0]?.c ?? 0);
}

async function main() {
  console.log("[limpar] ⚠ Zerando dados transacionais de teste…");

  // Snapshot ANTES
  const antes = {
    pedidos: await contar("pedidos"),
    compras: await contar("compras"),
    pedido_eventos: await contar("pedido_eventos"),
    compra_eventos: await contar("compra_eventos"),
    movimentacoes: await contar("movimentacoes"),
    notificacoes: await contar("notificacoes"),
    audit_log: await contar("audit_log"),
  };
  console.log("[limpar] Antes:", antes);

  // Preservados — só pra confirmar depois
  const frotasAntes = await contar("frotas");
  const pecasAntes = await contar("pecas");
  const usuariosAntes = await contar("usuarios");

  await db.transaction(async (tx) => {
    // Desativa triggers na sessão (incl. audit_log_no_update/delete/truncate).
    // Só o owner tem esse privilégio.
    await tx.execute(sql`SET LOCAL session_replication_role = replica`);

    // Ordem por FK (filhos antes dos pais)
    await tx.execute(sql`DELETE FROM notificacoes`);
    await tx.execute(sql`DELETE FROM movimentacoes`);
    await tx.execute(sql`DELETE FROM pedido_eventos`);
    await tx.execute(sql`DELETE FROM compra_eventos`);
    await tx.execute(sql`DELETE FROM compras`);
    await tx.execute(sql`DELETE FROM pedidos`);
    await tx.execute(sql`DELETE FROM audit_log`);

    // Reinicia sequências pra IDs começarem do 1 em produção
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
  const depois = {
    pedidos: await contar("pedidos"),
    compras: await contar("compras"),
    pedido_eventos: await contar("pedido_eventos"),
    compra_eventos: await contar("compra_eventos"),
    movimentacoes: await contar("movimentacoes"),
    notificacoes: await contar("notificacoes"),
    audit_log: await contar("audit_log"),
  };
  const frotasDepois = await contar("frotas");
  const pecasDepois = await contar("pecas");
  const usuariosDepois = await contar("usuarios");

  console.log("[limpar] ─────────────────────────────────────────");
  console.log("[limpar] ✓ Removidos:");
  console.log(`[limpar]   pedidos:         ${antes.pedidos} → ${depois.pedidos}`);
  console.log(`[limpar]   compras:         ${antes.compras} → ${depois.compras}`);
  console.log(`[limpar]   pedido_eventos:  ${antes.pedido_eventos} → ${depois.pedido_eventos}`);
  console.log(`[limpar]   compra_eventos:  ${antes.compra_eventos} → ${depois.compra_eventos}`);
  console.log(`[limpar]   movimentacoes:   ${antes.movimentacoes} → ${depois.movimentacoes}`);
  console.log(`[limpar]   notificacoes:    ${antes.notificacoes} → ${depois.notificacoes}`);
  console.log(`[limpar]   audit_log:       ${antes.audit_log} → ${depois.audit_log}`);
  console.log("[limpar] ─────────────────────────────────────────");
  console.log("[limpar] ✓ Preservados intactos:");
  console.log(`[limpar]   frotas:    ${frotasAntes} (${frotasDepois} depois)`);
  console.log(`[limpar]   pecas:     ${pecasAntes} (${pecasDepois} depois)`);
  console.log(`[limpar]   usuarios:  ${usuariosAntes} (${usuariosDepois} depois)`);
  console.log("[limpar] ─────────────────────────────────────────");

  if (
    frotasAntes !== frotasDepois ||
    pecasAntes !== pecasDepois ||
    usuariosAntes !== usuariosDepois
  ) {
    console.error("[limpar] ⚠ AVISO: contagem de tabela preservada MUDOU. Investigue.");
    process.exit(2);
  }

  console.log("[limpar] Pronto. Sistema limpo pra produção.");
  process.exit(0);
}

main().catch((e) => {
  console.error("[limpar] ERRO:", e);
  process.exit(1);
});
