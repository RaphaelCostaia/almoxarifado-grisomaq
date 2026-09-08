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
// Alternativa via UI: aba Auditoria → "Zona de perigo" → digitar
// "LIMPAR DADOS DE TESTE" → clicar botão vermelho. Mesmo efeito.
import { limparDadosTeste } from "@/lib/limpar-dados-teste";

async function main() {
  console.log("[limpar] Zerando dados transacionais de teste…");
  const r = await limparDadosTeste();

  console.log("[limpar] ─────────────────────────────────────────");
  console.log("[limpar] ✓ Removidos:");
  console.log(`[limpar]   pedidos:         ${r.antes.pedidos} → ${r.depois.pedidos}`);
  console.log(`[limpar]   compras:         ${r.antes.compras} → ${r.depois.compras}`);
  console.log(`[limpar]   pedido_eventos:  ${r.antes.pedido_eventos} → ${r.depois.pedido_eventos}`);
  console.log(`[limpar]   compra_eventos:  ${r.antes.compra_eventos} → ${r.depois.compra_eventos}`);
  console.log(`[limpar]   movimentacoes:   ${r.antes.movimentacoes} → ${r.depois.movimentacoes}`);
  console.log(`[limpar]   notificacoes:    ${r.antes.notificacoes} → ${r.depois.notificacoes}`);
  console.log(`[limpar]   audit_log:       ${r.antes.audit_log} → ${r.depois.audit_log}`);
  console.log("[limpar] ─────────────────────────────────────────");
  console.log("[limpar] ✓ Preservados intactos:");
  console.log(`[limpar]   frotas:    ${r.preservadosAntes.frotas} → ${r.preservadosDepois.frotas}`);
  console.log(`[limpar]   pecas:     ${r.preservadosAntes.pecas} → ${r.preservadosDepois.pecas}`);
  console.log(`[limpar]   usuarios:  ${r.preservadosAntes.usuarios} → ${r.preservadosDepois.usuarios}`);
  console.log("[limpar] ─────────────────────────────────────────");

  if (!r.ok) {
    console.error(`[limpar] AVISO: ${r.aviso}`);
    process.exit(2);
  }
  console.log("[limpar] Pronto. Sistema limpo pra produção.");
  process.exit(0);
}

main().catch((e) => {
  console.error("[limpar] ERRO:", e);
  process.exit(1);
});
