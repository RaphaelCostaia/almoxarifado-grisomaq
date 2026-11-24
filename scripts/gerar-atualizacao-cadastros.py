"""
Converte as planilhas do GMAIS num pacote de atualizacao em db/atualizacoes/<data>/,
que e aplicado em producao por db/atualizar-cadastros.ts (ver docs/atualizacao-planilhas-cliente.md).

Uso:
  python scripts/gerar-atualizacao-cadastros.py <pasta-saida> \
      [--frotas frotas.xlsx] [--pecas codigos.xlsx] [--agregados agregados.xlsx]

Cada planilha e opcional; so gera o JSON das que forem passadas.
"""
import argparse
import importlib.util
import json
import re
from pathlib import Path

import openpyxl

AQUI = Path(__file__).resolve().parent


def _modulo(nome: str, arquivo: str):
    spec = importlib.util.spec_from_file_location(nome, AQUI / arquivo)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


seed_frotas = _modulo("seed_frotas", "gerar-seed-frotas.py")
seed_pecas = _modulo("seed_pecas", "gerar-seed-pecas.py")
limpa = seed_frotas.limpa


def _espacos(v):
    s = limpa(v)
    return re.sub(r"\s+", " ", s) if s else None


def carregar_agregados(caminho: Path):
    """Listagem de Agregados do GMAIS -> frotas com categoria 'agregado' e numero 'AG<codigo>'."""
    ws = openpyxl.load_workbook(caminho, data_only=True)["Plan1"]
    registros = []
    for row in range(5, ws.max_row + 1):
        codigo = limpa(ws.cell(row=row, column=2).value)
        if not codigo:
            continue
        grupo = limpa(ws.cell(row=row, column=12).value)
        situacao = (limpa(ws.cell(row=row, column=9).value) or "").lower()
        baixado = situacao.startswith("baixad") or ws.cell(row=row, column=16).value is not None
        onde = (
            limpa(ws.cell(row=row, column=4).value)  # frota onde esta alocado
            or limpa(ws.cell(row=row, column=5).value)  # implemento
            or limpa(ws.cell(row=row, column=11).value)  # localizacao fisica
        )
        registros.append(
            {
                "numero": f"AG{codigo}",
                "categoria": "agregado",
                "modelo": _espacos(ws.cell(row=row, column=3).value),
                "marca": limpa(ws.cell(row=row, column=10).value),
                "descricao": re.sub(r"^\d+-\s*", "", grupo) if grupo else None,
                "ano": None,
                "placa": None,
                "chassi": None,
                "localizacao": onde[:64] if onde else None,
                "proprietario": None,
                "ativo": 0 if baixado else 1,
                "observacoes": None,
            }
        )
    return registros


def gravar(pasta: Path, nome: str, dados):
    pasta.mkdir(parents=True, exist_ok=True)
    arq = pasta / nome
    arq.write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")
    print(f"  {arq}: {len(dados)} registros")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("saida")
    ap.add_argument("--frotas")
    ap.add_argument("--pecas")
    ap.add_argument("--agregados")
    a = ap.parse_args()
    pasta = Path(a.saida)

    if a.frotas:
        frotas = seed_frotas.carregar_equipamentos(Path(a.frotas))
        nums = [f["numero"] for f in frotas]
        assert len(nums) == len(set(nums)), "numero de frota duplicado na planilha"
        gravar(pasta, "frotas.json", frotas)
    if a.pecas:
        pecas, sem_cod, sem_desc, _ = seed_pecas.carregar_pecas(Path(a.pecas))
        cods = [p["codigo"] for p in pecas]
        assert len(cods) == len(set(cods)), "codigo de peca duplicado na planilha"
        gravar(pasta, "pecas.json", pecas)
        print(f"    linhas puladas: {sem_cod} sem codigo, {sem_desc} sem descricao")
    if a.agregados:
        agregados = carregar_agregados(Path(a.agregados))
        nums = [g["numero"] for g in agregados]
        assert len(nums) == len(set(nums)), "codigo de agregado duplicado na planilha"
        gravar(pasta, "agregados.json", agregados)


if __name__ == "__main__":
    main()
