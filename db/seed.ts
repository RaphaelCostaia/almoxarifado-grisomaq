// Rodar com: `npm run db:seed`
import bcrypt from "bcryptjs";
import { db } from "./client";
import { pecas, pedidos, pedidoEventos, usuarios } from "./schema";

async function main() {
  console.log("Criando admin inicial (se ainda não existir)…");
  const senhaAdmin = process.env.ADMIN_SENHA ?? "grisomaq123";
  const hash = await bcrypt.hash(senhaAdmin, 10);
  try {
    await db.insert(usuarios).values({
      nome: "admin",
      senhaHash: hash,
      role: "admin",
      ativo: 1,
    });
    console.log(
      `→ Admin criado. Usuário: 'admin' | Senha: '${senhaAdmin}' (troque no /admin/usuarios)`
    );
  } catch (e: any) {
    if (String(e?.message ?? "").includes("duplicate")) {
      console.log("→ Admin já existia, pulei.");
    } else {
      throw e;
    }
  }

  // Cria um funcionário exemplo pra testar o fluxo
  try {
    await db.insert(usuarios).values({
      nome: "matheus",
      senhaHash: await bcrypt.hash("matheus123", 10),
      role: "funcionario",
      ativo: 1,
    });
    console.log(
      "→ Funcionário exemplo criado. Usuário: 'matheus' | Senha: 'matheus123'"
    );
  } catch {
    // ok
  }

  console.log("Semeando peças…");
  const [ventilador, abracadeira, parafuso] = await db
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
    .returning();

  console.log("Semeando pedido de exemplo…");
  const [pedidoEntregue] = await db
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
      pecaId: ventilador.id,
      entregueEm: new Date(),
    })
    .returning();

  await db.insert(pedidoEventos).values([
    { pedidoId: pedidoEntregue.id, autor: "matheus", texto: "Pedido registrado." },
    {
      pedidoId: pedidoEntregue.id,
      autor: "admin",
      texto: "Peça localizada em estoque — separando.",
    },
    {
      pedidoId: pedidoEntregue.id,
      autor: "admin",
      texto: "Peça entregue à frota.",
    },
  ]);

  console.log("✓ Seed concluído.");
  console.log("");
  console.log("→ Acesse /login com:");
  console.log("   admin    / grisomaq123   (administrador)");
  console.log("   matheus  / matheus123    (funcionário)");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
