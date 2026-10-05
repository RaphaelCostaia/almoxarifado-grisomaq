"""
Gera os 3 manuais em PDF a partir de docs/*.md.

Uso: python scripts/gerar-manuais.py
Requer: pip install fpdf2

Layout — versão visual (v2):
- Capa colorida cheia (metade laranja, metade branca) com título grande
- H1 sempre em nova página, com número grande + linha decorativa
- H2 com barra lateral laranja
- H3 com sublinhado suave
- Bullets com marcador redondo laranja, com INDENT correto (sem sobreposição)
- Listas numeradas com círculo colorido pro número
- Callouts visuais: [i] Nota / [!] Atenção / [OK] Dica
  (detectados quando parágrafo começa com "**Nota:**", "**Atenção:**", "**Dica:**")
- Blocos de código com borda esquerda cinza + fundo suave
- Cabeçalho com título do manual em texto pequeno cinza
- Rodapé com nome do manual à esquerda + página X / Y à direita
- Espaçamento generoso pra respirar
- Impressão A4, funciona em P&B (usa pesos + tons cinza como fallback)
"""
from datetime import date
from pathlib import Path
import re

from fpdf import FPDF

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

# --- paleta ---
BRAND = (216, 105, 32)           # laranja principal
BRAND_LIGHT = (247, 235, 224)    # fundo suave laranja
DARK = (30, 30, 32)              # texto principal
GRAY = (110, 110, 110)           # texto secundário
GRAY_LIGHT = (200, 200, 200)     # bordas leves
CODE_BG = (245, 244, 242)        # fundo de código
INFO_BORDER = (100, 150, 200)    # azul claro
INFO_BG = (232, 240, 249)
WARN_BORDER = (200, 140, 40)     # âmbar
WARN_BG = (252, 245, 230)
OK_BORDER = (95, 155, 100)       # verde
OK_BG = (233, 245, 234)

# --- geometria ---
MARGEM = 22                      # margem lateral
LARGURA_UTIL = 210 - MARGEM * 2


class ManualPDF(FPDF):
    def __init__(self, titulo_capa: str, subtitulo: str):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.titulo_capa = titulo_capa
        self.subtitulo = subtitulo
        self.pular_hf = True
        self.h1_atual = ""  # rótulo mostrado no rodapé
        self.set_auto_page_break(auto=True, margin=25)
        self.set_margins(left=MARGEM, top=25, right=MARGEM)

    def _sanit(self, s: str) -> str:
        return sanitizar_latin1(s)

    # ---------------- cabeçalho / rodapé ----------------
    def header(self):
        if self.pular_hf:
            return
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*GRAY)
        # linha superior fina
        self.set_draw_color(*GRAY_LIGHT)
        self.set_line_width(0.2)
        self.line(MARGEM, 18, 210 - MARGEM, 18)
        self.set_y(11)
        self.set_x(MARGEM)
        self.cell(
            LARGURA_UTIL / 2, 6, self._sanit(self.titulo_capa), align="L"
        )
        self.cell(
            LARGURA_UTIL / 2,
            6,
            "Fluxo de Peças GRISOMAQ",
            align="R",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.set_y(22)

    def footer(self):
        if self.pular_hf:
            return
        self.set_y(-16)
        self.set_draw_color(*GRAY_LIGHT)
        self.set_line_width(0.2)
        self.line(MARGEM, self.get_y(), 210 - MARGEM, self.get_y())
        self.ln(2)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*GRAY)
        if self.h1_atual:
            self.cell(
                LARGURA_UTIL / 2, 5, self._sanit(self.h1_atual), align="L"
            )
        else:
            self.cell(LARGURA_UTIL / 2, 5, "", align="L")
        self.cell(
            LARGURA_UTIL / 2,
            5,
            f"Página {self.page_no()} / {{nb}}",
            align="R",
        )

    # ---------------- capa ----------------
    def desenhar_capa(self):
        self.pular_hf = True
        self.add_page()
        # Metade superior laranja
        self.set_fill_color(*BRAND)
        self.rect(0, 0, 210, 148, style="F")

        # Logo/marca textual
        self.set_y(30)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(255, 255, 255)
        self.cell(
            0,
            5,
            "FLUXO DE PEÇAS GRISOMAQ",
            align="C",
            new_x="LMARGIN",
            new_y="NEXT",
        )

        # Título grande
        self.ln(20)
        self.set_font("Helvetica", "B", 32)
        self.cell(
            0,
            18,
            self._sanit(self.titulo_capa),
            align="C",
            new_x="LMARGIN",
            new_y="NEXT",
        )

        # Selo/linha decorativa
        self.ln(6)
        self.set_draw_color(255, 255, 255)
        self.set_line_width(1.2)
        self.line(85, self.get_y(), 125, self.get_y())

        # Subtítulo (metade branca)
        self.set_y(170)
        self.set_font("Helvetica", "", 13)
        self.set_text_color(*DARK)
        self.multi_cell(0, 8, self._sanit(self.subtitulo), align="C")

        # Rodapé da capa
        self.set_y(255)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*BRAND)
        self.cell(
            0,
            6,
            "GRISOMAQ",
            align="C",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*GRAY)
        self.cell(
            0,
            5,
            "Sistema interno de almoxarifado",
            align="C",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.cell(
            0,
            5,
            f"Manual gerado em {date.today().strftime('%d/%m/%Y')}",
            align="C",
        )

    def iniciar_conteudo(self):
        # Ativa cabeçalho/rodapé; o primeiro h1() adiciona a página nova.
        # (não adiciona página aqui pra evitar folha em branco antes do 1º H1)
        self.pular_hf = False

    # ---------------- elementos ----------------
    def _garantir_espaco(self, altura: float):
        """Adiciona página se o restante da atual não comportar `altura`."""
        limite = self.h - self.b_margin
        if self.get_y() + altura > limite:
            self.add_page()

    def _estimar_altura(self, texto: str, largura: float, line_h: float) -> float:
        """Mede a altura de um texto multi-linha sem mover o cursor.
        Usa dry_run do fpdf2; se não disponível, usa heurística por chars."""
        x, y = self.get_x(), self.get_y()
        try:
            out = self.multi_cell(
                largura, line_h, texto, dry_run=True, output="LINES"
            )
            n = len(out) if out else 1
        except Exception:
            # Heurística: ~2.1mm por char em 11pt sans → largura efetiva
            chars_por_linha = max(20, int(largura / 2.1))
            n = max(1, (len(texto) // chars_por_linha) + 1)
        self.set_xy(x, y)
        return n * line_h

    def paragrafo(self, texto: str):
        if not texto.strip():
            return
        # Detecta callout: "Nota:", "Atenção:", "Dica:", "Importante:"
        low = texto.strip().lower()
        if low.startswith(("nota:", "atenção:", "atencao:", "dica:", "importante:", "cuidado:")):
            self._callout(texto)
            return
        self.set_x(MARGEM)
        self.set_font("Helvetica", "", 11)
        self.set_text_color(*DARK)
        self.multi_cell(0, 6.2, texto, align="J", new_x="LMARGIN", new_y="NEXT")
        self.ln(3.5)

    def _callout(self, texto: str):
        # Escolhe estilo baseado no prefixo
        low = texto.strip().lower()
        if low.startswith(("atenção:", "atencao:", "cuidado:", "importante:")):
            border, bg, rotulo = WARN_BORDER, WARN_BG, "!"
        elif low.startswith("dica:"):
            border, bg, rotulo = OK_BORDER, OK_BG, "OK"
        else:
            border, bg, rotulo = INFO_BORDER, INFO_BG, "i"

        # Reserva altura estimada
        self.ln(2)
        self.set_font("Helvetica", "", 10.5)
        # Calcula altura via dry-run: usa multi_cell com split_only
        x0 = self.get_x()
        y0 = self.get_y()
        largura_interna = LARGURA_UTIL - 12
        # Retira o prefixo "Xxx:" pra formatar em negrito depois
        prefixo, resto = "", texto
        m = re.match(r"^([A-Za-zÀ-ú]+):\s*(.*)$", texto.strip(), flags=re.DOTALL)
        if m:
            prefixo = m.group(1)
            resto = m.group(2)

        altura_texto = self._estimar_altura(resto, largura_interna, 5.5) + 4

        altura_caixa = max(altura_texto + 3, 14)

        # Se não couber no restante da página, quebra ANTES de desenhar
        limite = self.h - self.b_margin
        if y0 + altura_caixa > limite:
            self.add_page()
            y0 = self.get_y()
            x0 = self.get_x()

        # Desenha borda esquerda colorida + fundo suave
        self.set_fill_color(*bg)
        self.set_draw_color(*border)
        self.rect(x0, y0, LARGURA_UTIL, altura_caixa, style="F")
        self.set_line_width(1.2)
        self.line(x0, y0, x0, y0 + altura_caixa)
        self.set_line_width(0.2)

        # Rótulo "!" / "i" / "OK" no canto
        self.set_xy(x0 + 3, y0 + 3)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*border)
        self.cell(6, 5, self._sanit(f"[{rotulo}]"))

        # Prefixo em negrito
        self.set_xy(x0 + 12, y0 + 3)
        if prefixo:
            self.set_font("Helvetica", "B", 10.5)
            self.set_text_color(*DARK)
            self.cell(0, 5.5, self._sanit(prefixo + ":"), new_x="LMARGIN", new_y="NEXT")
            self.set_x(x0 + 12)

        # Texto normal do callout
        self.set_font("Helvetica", "", 10.5)
        self.set_text_color(*DARK)
        self.set_xy(x0 + 12, y0 + (10 if prefixo else 3))
        self.multi_cell(largura_interna, 5.5, resto, new_x="LMARGIN", new_y="NEXT")

        # Move Y pra fim da caixa
        self.set_y(y0 + altura_caixa + 2)
        self.set_x(x0)
        self.ln(2)

    def bullet(self, texto: str):
        self.set_font("Helvetica", "", 11)
        self.set_text_color(*DARK)
        x0 = MARGEM
        indent = 6
        largura = LARGURA_UTIL - indent
        altura = self._estimar_altura(texto, largura, 6) + 2
        self._garantir_espaco(altura)
        y = self.get_y()
        # Bullet redondo
        self.set_fill_color(*BRAND)
        self.ellipse(x0 + 1.2, y + 2.4, 1.6, 1.6, style="F")
        self.set_xy(x0 + indent, y)
        self.multi_cell(largura, 6, texto, new_x="LMARGIN", new_y="NEXT")
        self.ln(1.5)

    def numero(self, n: int, texto: str):
        self.ln(1)
        x0 = MARGEM
        indent = 10
        largura = LARGURA_UTIL - indent
        altura = self._estimar_altura(texto, largura, 6) + 2
        self._garantir_espaco(altura)
        y = self.get_y()
        # Bolinha
        self.set_fill_color(*BRAND)
        self.ellipse(x0 - 0.2, y + 0.3, 6.5, 6.5, style="F")
        # Número dentro da bolinha
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(255, 255, 255)
        num_str = str(n)
        offset_x = 1.6 if len(num_str) == 1 else 0.6
        self.set_xy(x0 + offset_x, y + 1.4)
        self.cell(6.5, 4.5, self._sanit(num_str), align="C")
        # Texto ao lado
        self.set_xy(x0 + indent, y)
        self.set_font("Helvetica", "", 11)
        self.set_text_color(*DARK)
        self.multi_cell(largura, 6, texto, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def h1(self, texto: str):
        # Adiciona nova página só se a atual tiver conteúdo (evita folha vazia
        # quando o auto_page_break acabou de rolar) OU se ainda estivermos na
        # capa.
        na_capa = self.page_no() == 1
        pagina_com_conteudo = self.get_y() > 30  # topo é 25 + margem visual
        if na_capa or pagina_com_conteudo:
            self.add_page()
        self.h1_atual = texto  # atualiza rodapé
        self.ln(2)
        # Número/prefixo grande e claro
        # Detecta se começa com "N." ou "N " pra separar número
        m = re.match(r"^(\d+)\.?\s+(.*)$", texto)
        if m:
            n = m.group(1)
            resto = m.group(2)
            # Bloco laranja com número
            y = self.get_y()
            self.set_fill_color(*BRAND)
            self.rect(MARGEM, y, 14, 14, style="F")
            self.set_font("Helvetica", "B", 18)
            self.set_text_color(255, 255, 255)
            self.set_xy(MARGEM, y + 1.5)
            self.cell(14, 12, n, align="C")
            # Título ao lado
            self.set_xy(MARGEM + 18, y + 1)
            self.set_font("Helvetica", "B", 20)
            self.set_text_color(*DARK)
            self.multi_cell(LARGURA_UTIL - 18, 8, resto, new_x="LMARGIN", new_y="NEXT")
            # Garante Y abaixo do bloco laranja mesmo se o título ocupou 1 linha
            if self.get_y() < y + 16:
                self.set_y(y + 16)
        else:
            self.set_font("Helvetica", "B", 22)
            self.set_text_color(*BRAND)
            self.multi_cell(0, 10, texto, new_x="LMARGIN", new_y="NEXT")

        # Linha decorativa suave
        self.ln(2)
        self.set_draw_color(*BRAND)
        self.set_line_width(0.6)
        y = self.get_y()
        self.line(MARGEM, y, MARGEM + 40, y)
        self.ln(8)

    def h2(self, texto: str):
        # Barra lateral colorida + texto — reserva espaço pra não ficar órfão
        self._garantir_espaco(22)
        self.ln(4)
        y = self.get_y()
        self.set_fill_color(*BRAND)
        self.rect(MARGEM - 3, y + 1, 1.5, 6, style="F")
        self.set_font("Helvetica", "B", 13.5)
        self.set_text_color(*DARK)
        self.set_x(MARGEM)
        self.multi_cell(0, 8, texto, new_x="LMARGIN", new_y="NEXT")
        self.ln(1.5)

    def h3(self, texto: str):
        self._garantir_espaco(14)
        self.ln(2)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*BRAND)
        self.set_x(MARGEM)
        self.multi_cell(0, 6, texto, new_x="LMARGIN", new_y="NEXT")
        self.ln(0.5)

    def bloco_codigo(self, texto: str):
        self.ln(1)
        linhas = self._sanit(texto).split("\n")
        alt = len(linhas) * 4.8 + 4
        self._garantir_espaco(alt + 3)
        x0 = self.get_x()
        y0 = self.get_y()
        self.set_fill_color(*CODE_BG)
        self.rect(x0, y0, LARGURA_UTIL, alt, style="F")
        # Borda esquerda cinza
        self.set_draw_color(*GRAY_LIGHT)
        self.set_line_width(1)
        self.line(x0, y0, x0, y0 + alt)
        self.set_line_width(0.2)
        self.set_xy(x0 + 4, y0 + 2)
        self.set_font("Courier", "", 9)
        self.set_text_color(*DARK)
        for l in linhas:
            self.set_x(x0 + 4)
            self.cell(LARGURA_UTIL - 4, 4.8, l, new_x="LMARGIN", new_y="NEXT")
        self.set_y(y0 + alt + 2)
        self.set_x(MARGEM)
        self.ln(1)


# Substituições pra latin-1
LATIN1_MAP = {
    "—": "-",
    "–": "-",
    "…": "...",
    "“": '"', "”": '"',
    "‘": "'", "’": "'",
    " ": " ",
    "→": "->", "←": "<-",
    "✓": "OK", "✗": "X",
    "⚠": "[!]",
    "⬆": "^", "⬇": "v",
    "🔴": "[!]",
    "📄": "", "📅": "", "📥": "", "📌": "", "🔧": "", "🗑": "",
    "⊕": "+",
    "⬛": "*",
    "‑": "-",
    "↵": "",
    "⌗": "", "⌕": "",
    "⌔": "",
    "✑": "",
    "✅": "OK",
    "❌": "X",
    "⚡": "*", "⭐": "*", "⭕": "O",
    "□": "[]", "■": "[X]",
    "☐": "[ ]", "☑": "[X]",
    "⬡": "*", "⚛": "*",
    "▶": ">",
    "▲": "^", "▼": "v",
    "•": "-",
    "▪": "-",
    "◦": "-",
}


def sanitizar_latin1(texto: str) -> str:
    for k, v in LATIN1_MAP.items():
        texto = texto.replace(k, v)
    out = []
    for ch in texto:
        try:
            ch.encode("latin-1")
            out.append(ch)
        except UnicodeEncodeError:
            out.append("")
    return "".join(out)


def render_inline(pdf: ManualPDF, texto: str) -> str:
    """Retira marcadores markdown inline e sanitiza pra latin-1."""
    texto = re.sub(r"\*\*(.+?)\*\*", r"\1", texto)
    texto = re.sub(r"(?<!\*)\*(?!\*)(.+?)\*(?!\*)", r"\1", texto)
    texto = re.sub(r"`([^`]+)`", r'"\1"', texto)
    texto = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", texto)
    return sanitizar_latin1(texto)


def parse_markdown(pdf: ManualPDF, md: str):
    """Parse simples: # H1, ## H2, ### H3, - bullet, N. numerado, ``` código."""
    linhas = md.split("\n")
    i = 0
    n = len(linhas)
    while i < n:
        linha = linhas[i]

        # Bloco de código ```
        if linha.strip().startswith("```"):
            i += 1
            buf = []
            while i < n and not linhas[i].strip().startswith("```"):
                buf.append(linhas[i])
                i += 1
            if buf:
                pdf.bloco_codigo("\n".join(buf))
            i += 1
            continue

        # Headings
        if linha.startswith("# "):
            pdf.h1(render_inline(pdf, linha[2:].strip()))
            i += 1
            continue
        if linha.startswith("## "):
            pdf.h2(render_inline(pdf, linha[3:].strip()))
            i += 1
            continue
        if linha.startswith("### "):
            pdf.h3(render_inline(pdf, linha[4:].strip()))
            i += 1
            continue

        # Lista bullet
        if linha.startswith("- "):
            item = render_inline(pdf, linha[2:].strip())
            j = i + 1
            while j < n and (linhas[j].startswith("  ") or linhas[j].startswith("\t")):
                item += " " + render_inline(pdf, linhas[j].strip())
                j += 1
            pdf.bullet(item)
            i = j
            continue

        # Numerada
        m = re.match(r"^(\d+)\.\s+(.*)$", linha)
        if m:
            item = render_inline(pdf, m.group(2))
            j = i + 1
            while j < n and (linhas[j].startswith("  ") or linhas[j].startswith("\t")):
                item += " " + render_inline(pdf, linhas[j].strip())
                j += 1
            pdf.numero(int(m.group(1)), item)
            i = j
            continue

        # Parágrafo
        if linha.strip():
            buf = [linha]
            j = i + 1
            while j < n and linhas[j].strip() and not linhas[j].startswith(
                ("#", "-", "```")
            ) and not re.match(r"^\d+\.\s", linhas[j]):
                buf.append(linhas[j])
                j += 1
            pdf.paragrafo(render_inline(pdf, " ".join(l.strip() for l in buf)))
            i = j
        else:
            i += 1


def gerar(md_path: Path, titulo_capa: str, subtitulo: str, pdf_out: Path):
    md = md_path.read_text(encoding="utf-8")
    # Descarta o H1 do topo (já vai na capa)
    linhas = md.split("\n")
    while linhas and not linhas[0].startswith("# "):
        linhas.pop(0)
    if linhas:
        linhas.pop(0)
    while linhas and not linhas[0].strip():
        linhas.pop(0)
    md_sem_titulo = "\n".join(linhas)

    pdf = ManualPDF(titulo_capa=titulo_capa, subtitulo=subtitulo)
    pdf.set_title(titulo_capa)
    pdf.set_author("GRISOMAQ")
    pdf.desenhar_capa()
    pdf.iniciar_conteudo()
    parse_markdown(pdf, md_sem_titulo)
    pdf.output(str(pdf_out))
    print(f"[manuais] {pdf_out.name} gerado ({pdf_out.stat().st_size // 1024} KB)")


def main():
    gerar(
        DOCS / "manual-usuario.md",
        titulo_capa="Manual do Usuário",
        subtitulo="Guia rápido para funcionários: abrir pedidos, acompanhar e consultar estoque",
        pdf_out=ROOT / "MANUAL-USUARIO.pdf",
    )
    gerar(
        DOCS / "manual-admin.md",
        titulo_capa="Manual do Administrador",
        subtitulo="Operação completa do sistema: pedidos, compras, estoque, frotas, usuários e auditoria",
        pdf_out=ROOT / "MANUAL-ADMIN.pdf",
    )
    gerar(
        DOCS / "manual-troca-oleo.md",
        titulo_capa="Manual — Troca de Óleo",
        subtitulo="Fluxo do módulo Manutenção: importar PDF do GMAIS, programar OS e concluir trocas com baixa automática de estoque",
        pdf_out=ROOT / "MANUAL-TROCA-OLEO.pdf",
    )


if __name__ == "__main__":
    main()
