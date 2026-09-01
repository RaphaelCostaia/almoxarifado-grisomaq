import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
  numeric,
  index,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "funcionario"]);

export const prioridadeEnum = pgEnum("prioridade", ["normal", "urgente"]);

export const statusPedidoEnum = pgEnum("status_pedido", [
  "solicitada",
  "providenciando",
  "aguardando_buscar",
  "aguardando_retirada",
  "entregue",
  "cancelada",
]);

export const statusCompraEnum = pgEnum("status_compra", [
  "rascunho",
  "aprovada",
  "comprada",
  "recebida",
  "cancelada",
]);

export const tipoMovimentacaoEnum = pgEnum("tipo_movimentacao", [
  "entrada",
  "saida",
  "ajuste",
]);

export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 64 }).notNull().unique(),
  senhaHash: varchar("senha_hash", { length: 255 }).notNull(),
  role: roleEnum("role").notNull().default("funcionario"),
  ativo: integer("ativo").notNull().default(1),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const pecas = pgTable(
  "pecas",
  {
    id: serial("id").primaryKey(),
    codigo: varchar("codigo", { length: 64 }).unique(),
    nome: varchar("nome", { length: 255 }).notNull().unique(),
    unidade: varchar("unidade", { length: 16 }).notNull().default("un"),
    saldo: integer("saldo").notNull().default(0),
    minimo: integer("minimo").notNull().default(0),
    maximo: integer("maximo").notNull().default(0),
    localizacao: varchar("localizacao", { length: 128 }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    nomeIdx: index("pecas_nome_idx").on(t.nome),
  })
);

export const pedidos = pgTable(
  "pedidos",
  {
    id: serial("id").primaryKey(),
    frota: varchar("frota", { length: 64 }).notNull(),
    local: varchar("local", { length: 64 }),
    descricao: text("descricao").notNull(),
    quantidade: integer("quantidade").notNull().default(1),
    unidade: varchar("unidade", { length: 16 }).notNull().default("un"),
    motivo: varchar("motivo", { length: 64 }).notNull(),
    solicitante: varchar("solicitante", { length: 64 }).notNull(),
    prioridade: prioridadeEnum("prioridade").notNull().default("normal"),
    status: statusPedidoEnum("status").notNull().default("solicitada"),
    fotoUrl: text("foto_url"),
    observacoes: text("observacoes"),
    pecaId: integer("peca_id").references(() => pecas.id, {
      onDelete: "set null",
    }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
    entregueEm: timestamp("entregue_em", { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index("pedidos_status_idx").on(t.status),
    frotaIdx: index("pedidos_frota_idx").on(t.frota),
    localIdx: index("pedidos_local_idx").on(t.local),
  })
);

export const notificacoes = pgTable(
  "notificacoes",
  {
    id: serial("id").primaryKey(),
    destinatario: varchar("destinatario", { length: 64 }).notNull(),
    pedidoId: integer("pedido_id").references(() => pedidos.id, {
      onDelete: "cascade",
    }),
    texto: text("texto").notNull(),
    lida: integer("lida").notNull().default(0),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    destIdx: index("notificacoes_dest_idx").on(t.destinatario, t.lida),
  })
);

export const pedidoEventos = pgTable(
  "pedido_eventos",
  {
    id: serial("id").primaryKey(),
    pedidoId: integer("pedido_id")
      .references(() => pedidos.id, { onDelete: "cascade" })
      .notNull(),
    autor: varchar("autor", { length: 64 }).notNull(),
    texto: text("texto").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pedidoIdx: index("pedido_eventos_pedido_idx").on(t.pedidoId),
  })
);

export const compras = pgTable(
  "compras",
  {
    id: serial("id").primaryKey(),
    pedidoId: integer("pedido_id").references(() => pedidos.id, {
      onDelete: "set null",
    }),
    pecaId: integer("peca_id").references(() => pecas.id, {
      onDelete: "set null",
    }),
    descricao: text("descricao").notNull(),
    quantidade: integer("quantidade").notNull().default(1),
    unidade: varchar("unidade", { length: 16 }).notNull().default("un"),
    fornecedor: varchar("fornecedor", { length: 128 }),
    valorUnit: numeric("valor_unit", { precision: 12, scale: 2 }),
    valorTotal: numeric("valor_total", { precision: 12, scale: 2 }),
    prazo: timestamp("prazo", { withTimezone: true }),
    status: statusCompraEnum("status").notNull().default("rascunho"),
    nfNumero: varchar("nf_numero", { length: 64 }),
    nfUrl: text("nf_url"),
    observacoes: text("observacoes"),
    autor: varchar("autor", { length: 64 }).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    statusIdx: index("compras_status_idx").on(t.status),
  })
);

export const compraEventos = pgTable(
  "compra_eventos",
  {
    id: serial("id").primaryKey(),
    compraId: integer("compra_id")
      .references(() => compras.id, { onDelete: "cascade" })
      .notNull(),
    autor: varchar("autor", { length: 64 }).notNull(),
    texto: text("texto").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }
);

export const movimentacoes = pgTable(
  "movimentacoes",
  {
    id: serial("id").primaryKey(),
    pecaId: integer("peca_id")
      .references(() => pecas.id, { onDelete: "cascade" })
      .notNull(),
    tipo: tipoMovimentacaoEnum("tipo").notNull(),
    quantidade: integer("quantidade").notNull(),
    motivo: varchar("motivo", { length: 128 }),
    pedidoId: integer("pedido_id").references(() => pedidos.id, {
      onDelete: "set null",
    }),
    compraId: integer("compra_id").references(() => compras.id, {
      onDelete: "set null",
    }),
    autor: varchar("autor", { length: 64 }).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pecaIdx: index("movimentacoes_peca_idx").on(t.pecaId),
  })
);

export type Usuario = typeof usuarios.$inferSelect;
export type NovoUsuario = typeof usuarios.$inferInsert;

export type Peca = typeof pecas.$inferSelect;
export type NovaPeca = typeof pecas.$inferInsert;
export type Pedido = typeof pedidos.$inferSelect;
export type NovoPedido = typeof pedidos.$inferInsert;
export type PedidoEvento = typeof pedidoEventos.$inferSelect;
export type Compra = typeof compras.$inferSelect;
export type NovaCompra = typeof compras.$inferInsert;
export type CompraEvento = typeof compraEventos.$inferSelect;
export type Movimentacao = typeof movimentacoes.$inferSelect;
export type Notificacao = typeof notificacoes.$inferSelect;
export type NovaNotificacao = typeof notificacoes.$inferInsert;

export const STATUS_PEDIDO_LABELS: Record<Pedido["status"], string> = {
  solicitada: "Solicitada",
  providenciando: "Providenciando",
  aguardando_buscar: "Aguardando buscar",
  aguardando_retirada: "Aguardando retirada",
  entregue: "Entregue",
  cancelada: "Cancelado",
};

export const STATUS_PEDIDO_ORDEM: Pedido["status"][] = [
  "solicitada",
  "providenciando",
  "aguardando_buscar",
  "aguardando_retirada",
  "entregue",
  "cancelada",
];

export const STATUS_COMPRA_LABELS: Record<Compra["status"], string> = {
  rascunho: "Rascunho",
  aprovada: "Aprovada",
  comprada: "Comprada",
  recebida: "Recebida",
  cancelada: "Cancelada",
};

export const STATUS_COMPRA_TRILHO: Compra["status"][] = [
  "rascunho",
  "aprovada",
  "comprada",
  "recebida",
];

export const MOTIVOS_PEDIDO = [
  "Quebra / manutenção corretiva",
  "Manutenção preventiva",
  "Reposição de estoque",
  "Melhoria / retrofit",
  "Outro",
] as const;
