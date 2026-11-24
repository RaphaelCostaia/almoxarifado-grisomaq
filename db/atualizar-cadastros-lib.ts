// Atualização em lote de frotas, agregados e peças a partir das planilhas do GMAIS.
// Regras de segurança (decididas com o cliente — "não podemos perder nenhum dado"):
//   - nada é apagado: o que existe no banco e não está na planilha fica intacto;
//   - registro excluído (soft delete) no sistema não é reativado nem alterado;
//   - campo em branco na planilha nunca apaga valor já preenchido no sistema;
//   - saldo, mínimo, máximo e localização de peças existentes nunca são tocados;
//   - unidade de peça só muda se o saldo for zero (senão o saldo mudaria de sentido);
//   - frota cujo número já existe com outra categoria é ignorada (sem sobrescrever).
import { createHash } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { auditLog, frotas, pecas } from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

export type FrotaPlanilha = {
  numero: string;
  categoria: "equipamento" | "implemento" | "centro_operacao" | "agregado";
  modelo: string | null;
  marca: string | null;
  descricao: string | null;
  ano: string | null;
  placa: string | null;
  chassi: string | null;
  localizacao: string | null;
  proprietario: string | null;
  ativo: number;
  observacoes: string | null;
};

export type PecaPlanilha = {
  codigo: string;
  nome: string;
  unidade: string;
  saldo: string;
  familia: string | null;
  codigoFabricante: string | null;
  codigoParalelo: string | null;
};

type Alteracao = { chave: string; id: number; mudancas: Record<string, [unknown, unknown]> };

export type Plano<T> = {
  inserir: T[];
  atualizar: Alteracao[];
  iguais: number;
  ignorados: { chave: string; motivo: string }[];
  vaziosPreservados: number;
  soNoSistema: number;
};

const CAMPOS_FROTA = [
  "modelo", "marca", "descricao", "ano", "placa", "chassi", "localizacao", "proprietario", "observacoes",
] as const;
const CAMPOS_PECA = ["nome", "familia", "codigoFabricante", "codigoParalelo"] as const;

const norm = (v: unknown) => (v == null ? null : String(v).trim() || null);

export function planejarFrotas(
  existentes: (typeof frotas.$inferSelect)[],
  planilha: FrotaPlanilha[]
): Plano<FrotaPlanilha> {
  const porNumero = new Map(existentes.map((f) => [f.numero, f]));
  const plano: Plano<FrotaPlanilha> = {
    inserir: [], atualizar: [], iguais: 0, ignorados: [], vaziosPreservados: 0, soNoSistema: 0,
  };
  for (const nova of planilha) {
    const atual = porNumero.get(nova.numero);
    if (!atual) {
      plano.inserir.push(nova);
      continue;
    }
    if (atual.deletadoEm) {
      plano.ignorados.push({ chave: nova.numero, motivo: "excluída no sistema (não reativada)" });
      continue;
    }
    if (atual.categoria !== nova.categoria) {
      plano.ignorados.push({
        chave: nova.numero,
        motivo: `número já usado por ${atual.categoria} (${atual.modelo ?? "sem modelo"})`,
      });
      continue;
    }
    const mudancas: Alteracao["mudancas"] = {};
    for (const c of CAMPOS_FROTA) {
      const antes = norm(atual[c]);
      const depois = norm(nova[c]);
      if (depois === null) {
        if (antes !== null) plano.vaziosPreservados++;
        continue;
      }
      if (antes !== depois) mudancas[c] = [antes, depois];
    }
    if (atual.ativo !== nova.ativo) mudancas.ativo = [atual.ativo, nova.ativo];
    if (Object.keys(mudancas).length) plano.atualizar.push({ chave: nova.numero, id: atual.id, mudancas });
    else plano.iguais++;
  }
  const naPlanilha = new Set(planilha.map((f) => f.numero));
  const categorias = new Set(planilha.map((f) => f.categoria));
  plano.soNoSistema = existentes.filter(
    (f) => !f.deletadoEm && categorias.has(f.categoria) && !naPlanilha.has(f.numero)
  ).length;
  return plano;
}

export function planejarPecas(
  existentes: (typeof pecas.$inferSelect)[],
  planilha: PecaPlanilha[]
): Plano<PecaPlanilha> {
  const porCodigo = new Map(existentes.filter((p) => p.codigo).map((p) => [p.codigo as string, p]));
  const plano: Plano<PecaPlanilha> = {
    inserir: [], atualizar: [], iguais: 0, ignorados: [], vaziosPreservados: 0, soNoSistema: 0,
  };
  for (const nova of planilha) {
    const atual = porCodigo.get(nova.codigo);
    if (!atual) {
      plano.inserir.push(nova);
      continue;
    }
    if (atual.deletadoEm) {
      plano.ignorados.push({ chave: nova.codigo, motivo: "excluída no sistema (não reativada)" });
      continue;
    }
    const mudancas: Alteracao["mudancas"] = {};
    for (const c of CAMPOS_PECA) {
      const antes = norm(atual[c]);
      const depois = norm(nova[c]);
      if (depois === null) {
        if (antes !== null) plano.vaziosPreservados++;
        continue;
      }
      if (antes !== depois) mudancas[c] = [antes, depois];
    }
    const unAntes = norm(atual.unidade);
    const unDepois = norm(nova.unidade);
    if (unDepois !== null && unAntes !== unDepois) {
      if (Number(atual.saldo) === 0) mudancas.unidade = [unAntes, unDepois];
      else
        plano.ignorados.push({
          chave: nova.codigo,
          motivo: `unidade ${unAntes}→${unDepois} não alterada: peça tem saldo ${Number(atual.saldo)} ${unAntes}`,
        });
    }
    if (Object.keys(mudancas).length) plano.atualizar.push({ chave: nova.codigo, id: atual.id, mudancas });
    else plano.iguais++;
  }
  const naPlanilha = new Set(planilha.map((p) => p.codigo));
  plano.soNoSistema = existentes.filter((p) => !p.deletadoEm && !(p.codigo && naPlanilha.has(p.codigo))).length;
  return plano;
}

// ---- auditoria: mesma hash-chain de lib/auditar.ts (verificável em /admin/auditoria) ----
function canonicalJson(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson((v as any)[k])).join(",") + "}";
}

async function auditar(
  tx: any,
  acao: "frotas_atualizar_lote" | "pecas_atualizar_lote",
  entidade: "frota" | "peca",
  resumo: string,
  diffBruto: unknown,
  atorNome: string
) {
  const diff = JSON.parse(JSON.stringify(diffBruto));
  const [ultimo] = await tx
    .select({ h: auditLog.hashCurr })
    .from(auditLog)
    .orderBy(desc(auditLog.id))
    .limit(1)
    .for("update");
  const hashPrev = ultimo?.h ?? "0".repeat(64);
  const linha = {
    acao, atorNome, atorRole: "admin", atorUid: null, diff, entidade, entidadeId: null,
    hashPrev, ip: null, requestId: null, resumo: resumo.slice(0, 255), userAgent: "cli/atualizar-cadastros",
  };
  const hashCurr = createHash("sha256").update(hashPrev + canonicalJson(linha)).digest("hex");
  await tx.insert(auditLog).values({ ...linha, hashCurr });
}

export type Resultado = {
  frotas?: Plano<FrotaPlanilha>;
  agregados?: Plano<FrotaPlanilha>;
  pecas?: Plano<PecaPlanilha>;
  aplicado: boolean;
};

const LOTE = 200;

async function contar(tx: any, tabela: typeof frotas | typeof pecas): Promise<number> {
  const [r] = await tx.select({ c: sql<number>`count(*)::int` }).from(tabela);
  return Number(r.c);
}

async function gravarFrotas(tx: any, plano: Plano<FrotaPlanilha>, rotulo: string, ator: string) {
  if (!plano.inserir.length && !plano.atualizar.length) return;
  const antes = await contar(tx, frotas);
  for (let i = 0; i < plano.inserir.length; i += LOTE) {
    await tx.insert(frotas).values(plano.inserir.slice(i, i + LOTE)).onConflictDoNothing({ target: frotas.numero });
  }
  for (const a of plano.atualizar) {
    const patch = Object.fromEntries(Object.entries(a.mudancas).map(([c, [, depois]]) => [c, depois]));
    await tx.update(frotas).set(patch).where(eq(frotas.id, a.id));
  }
  const depois = await contar(tx, frotas);
  if (depois < antes) throw new Error(`${rotulo}: contagem caiu de ${antes} para ${depois}. Nada foi gravado.`);
  await auditar(
    tx, "frotas_atualizar_lote", "frota",
    `${rotulo} (planilha GMAIS): ${plano.inserir.length} novos, ${plano.atualizar.length} atualizados, ` +
      `${plano.ignorados.length} ignorados.`,
    {
      inseridos: plano.inserir.length,
      atualizados: plano.atualizar.length,
      iguais: plano.iguais,
      ignorados: plano.ignorados.slice(0, 50),
      amostra: plano.atualizar.slice(0, 30).map((a) => ({ chave: a.chave, mudancas: a.mudancas })),
    },
    ator
  );
}

async function gravarPecas(tx: any, plano: Plano<PecaPlanilha>, ator: string) {
  if (!plano.inserir.length && !plano.atualizar.length) return;
  const antes = await contar(tx, pecas);
  for (let i = 0; i < plano.inserir.length; i += LOTE) {
    await tx.insert(pecas).values(plano.inserir.slice(i, i + LOTE)).onConflictDoNothing({ target: pecas.codigo });
  }
  for (const a of plano.atualizar) {
    // Só campos de catálogo — saldo/mínimo/máximo/localização nunca entram aqui.
    const patch = Object.fromEntries(Object.entries(a.mudancas).map(([c, [, depois]]) => [c, depois]));
    await tx.update(pecas).set(patch).where(eq(pecas.id, a.id));
  }
  const depois = await contar(tx, pecas);
  if (depois < antes) throw new Error(`Peças: contagem caiu de ${antes} para ${depois}. Nada foi gravado.`);
  await auditar(
    tx, "pecas_atualizar_lote", "peca",
    `Peças (planilha GMAIS): ${plano.inserir.length} novas, ${plano.atualizar.length} atualizadas, ` +
      `${plano.ignorados.length} ignoradas. Saldo de peças existentes não alterado.`,
    {
      inseridos: plano.inserir.length,
      atualizados: plano.atualizar.length,
      iguais: plano.iguais,
      ignorados: plano.ignorados.slice(0, 50),
      amostra: plano.atualizar.slice(0, 30).map((a) => ({ chave: a.chave, mudancas: a.mudancas })),
    },
    ator
  );
}

/** Calcula o plano e, se `aplicar`, grava tudo numa única transação (erro em qualquer parte = nada gravado). */
export async function executar(
  db: Db,
  dados: { frotas?: FrotaPlanilha[]; agregados?: FrotaPlanilha[]; pecas?: PecaPlanilha[] },
  opcoes: { aplicar: boolean; ator: string }
): Promise<Resultado> {
  return db.transaction(async (tx) => {
    const res: Resultado = { aplicado: false };
    const temFrotas = !!(dados.frotas?.length || dados.agregados?.length);
    const frotasBanco = temFrotas ? await tx.select().from(frotas) : [];
    if (dados.frotas?.length) res.frotas = planejarFrotas(frotasBanco, dados.frotas);
    if (dados.agregados?.length) res.agregados = planejarFrotas(frotasBanco, dados.agregados);
    if (dados.pecas?.length) res.pecas = planejarPecas(await tx.select().from(pecas), dados.pecas);
    if (!opcoes.aplicar) return res;

    if (res.frotas) await gravarFrotas(tx, res.frotas, "Frotas", opcoes.ator);
    if (res.agregados) await gravarFrotas(tx, res.agregados, "Agregados", opcoes.ator);
    if (res.pecas) await gravarPecas(tx, res.pecas, opcoes.ator);
    res.aplicado = true;
    return res;
  });
}
