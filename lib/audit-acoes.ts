// Ações canônicas do audit_log. Manter esta lista sincronizada com a UI
// (dropdown de filtro em /admin/auditoria) e com a documentação do cliente.
export const AUDIT_ACOES = [
  // Sessão
  "login_ok",
  "login_falha",
  "logout",
  // Pedidos
  "pedido_criar",
  "pedido_status",
  "pedido_editar",
  "pedido_comentar",
  "pedido_soft_delete",
  "pedidos_purge_cancelados",
  // Compras
  "compra_criar",
  "compra_aprovar",
  "compra_marcar_comprada",
  "compra_receber",
  "compra_cancelar",
  "compra_editar",
  "compra_soft_delete",
  // Peças
  "peca_criar",
  "peca_editar",
  "peca_soft_delete",
  "peca_ajuste_entrada",
  "peca_ajuste_saida",
  "peca_ajuste_direto",
  // Frotas
  "frota_criar",
  "frota_editar",
  "frota_soft_delete",
  // Usuários
  "usuario_criar",
  "usuario_ativar",
  "usuario_desativar",
  "usuario_reset_senha",
  "usuario_mudar_role",
  // Arquivos / export
  "arquivo_upload",
  "export_csv",
] as const;

export type AuditAcao = (typeof AUDIT_ACOES)[number];

export type AuditEntidade =
  | "pedido"
  | "compra"
  | "peca"
  | "frota"
  | "usuario"
  | "sessao"
  | "arquivo"
  | "export";

export const AUDIT_ACAO_LABELS: Record<AuditAcao, string> = {
  login_ok: "Login (sucesso)",
  login_falha: "Login (falha)",
  logout: "Logout",
  pedido_criar: "Pedido criado",
  pedido_status: "Pedido — mudança de status",
  pedido_editar: "Pedido editado",
  pedido_comentar: "Pedido — comentário",
  pedido_soft_delete: "Pedido excluído",
  pedidos_purge_cancelados: "Pedidos cancelados — expurgo em lote",
  compra_criar: "Compra criada",
  compra_aprovar: "Compra aprovada",
  compra_marcar_comprada: "Compra marcada como comprada",
  compra_receber: "Compra recebida",
  compra_cancelar: "Compra cancelada",
  compra_editar: "Compra editada",
  compra_soft_delete: "Compra excluída",
  peca_criar: "Peça cadastrada",
  peca_editar: "Peça editada",
  peca_soft_delete: "Peça excluída",
  peca_ajuste_entrada: "Estoque — entrada manual",
  peca_ajuste_saida: "Estoque — saída manual",
  peca_ajuste_direto: "Estoque — ajuste direto de saldo",
  frota_criar: "Frota cadastrada",
  frota_editar: "Frota editada",
  frota_soft_delete: "Frota excluída",
  usuario_criar: "Usuário criado",
  usuario_ativar: "Usuário ativado",
  usuario_desativar: "Usuário desativado",
  usuario_reset_senha: "Senha resetada",
  usuario_mudar_role: "Perfil (role) alterado",
  arquivo_upload: "Arquivo enviado",
  export_csv: "Exportação CSV",
};
