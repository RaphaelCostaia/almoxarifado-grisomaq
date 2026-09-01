// Rodar com: `npm run db:seed`
// Seed idempotente — pode rodar N vezes sem duplicar dados.
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "./client";
import { pecas, pedidos, pedidoEventos, usuarios } from "./schema";

async function main() {
  console.log("[seed] Criando admin (se ainda não existir)…");
  const senhaAdmin = process.env.ADMIN_SENHA ?? "grisomaq123";
  const hash = await bcrypt.hash(senhaAdmin, 10);
  const admins = await db
    .insert(usuarios)
    .values({ nome: "admin", senhaHash: hash, role: "admin", ativo: 1 })
    .onConflictDoNothing()
    .returning();
  if (admins.length > 0) {
    console.log(
      `[seed] → admin criado. Login: 'admin' | Senha: '${senhaAdmin}'`
    );
  } else {
    console.log("[seed] → admin já existia, pulei.");
  }

  console.log("[seed] Criando funcionário exemplo…");
  const fs = await db
    .insert(usuarios)
    .values({
      nome: "matheus",
      senhaHash: await bcrypt.hash("matheus123", 10),
      role: "funcionario",
      ativo: 1,
    })
    .onConflictDoNothing()
    .returning();
  if (fs.length > 0) {
    console.log("[seed] → matheus criado. Login: 'matheus' | Senha: 'matheus123'");
  }

  console.log("[seed] Semeando peças (idempotente por codigo)…");
  const inserted = await db
    .insert(pecas)
    .values([
      {
        codigo: "AC-VENT-01",
        nome: "Ventilador do ar condicionado",
        unidade: "un",
        saldo: 2,
        minimo: 1,
        maximo: 4,
        localizacao: "Prateleira A2",
      },
      {
        codigo: "MG-ABR-34",
        nome: "Abraçadeira de mangueira 3/4",
        unidade: "un",
        saldo: 30,
        minimo: 10,
        maximo: 60,
        localizacao: "Gaveta B1",
      },
      {
        codigo: "PF-M8-40",
        nome: "Parafuso M8 x 40 mm",
        unidade: "un",
        saldo: 150,
        minimo: 50,
        maximo: 300,
        localizacao: "Gaveta B3",
      },
    ])
    .onConflictDoNothing({ target: pecas.codigo })
    .returning();

  console.log(`[seed] → ${inserted.length} peças novas inseridas.`);

  // Pedido de exemplo só se ainda não há nenhum
  const total = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(pedidos);
  if ((total[0]?.c ?? 0) === 0) {
    console.log("[seed] Criando pedido exemplo…");
    const [vent] = await db.select().from(pecas).where(sql`codigo = 'AC-VENT-01'`);
    const [ped] = await db
      .insert(pedidos)
      .values({
        frota: "Frota 95",
        descricao: "1 ventilador do ar condicionado",
        quantidade: 1,
        unidade: "un",
        motivo: "Quebra / manutenção corretiva",
        solicitante: "matheus",
        prioridade: "normal",
        status: "entregue",
        pecaId: vent?.id ?? null,
        entregueEm: new Date(),
      })
      .returning();
    await db.insert(pedidoEventos).values([
      { pedidoId: ped.id, autor: "matheus", texto: "Pedido registrado." },
      {
        pedidoId: ped.id,
        autor: "admin",
        texto: "Peça localizada em estoque — separando.",
      },
      { pedidoId: ped.id, autor: "admin", texto: "Peça entregue à frota." },
    ]);
    console.log("[seed] → pedido exemplo criado.");
  } else {
    console.log(
      `[seed] → já existem ${total[0]?.c} pedidos, pulei o exemplo.`
    );
  }

  console.log("[seed] ✓ Concluído.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] ERRO:", err);
  process.exit(1);
});
