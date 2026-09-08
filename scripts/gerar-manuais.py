"""
Gera MANUAL-USUARIO.pdf e MANUAL-ADMIN.pdf a partir de docs/manual-usuario.md
e docs/manual-admin.md.

Uso: python scripts/gerar-manuais.py

Requer: pip install fpdf2

Layout: capa colorida, cabeçalho/rodapé em cada página, títulos hierárquicos
(H1 laranja, H2 preto, H3 cinza), corpo justificado, listas com bullet, blocos
de código em fonte monoespaçada com fundo. Impressão A4, funciona em P&B.
"""
from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

BRAND_ORANGE = (216, 105, 32)
DARK = (25, 25, 25)
GRAY = (110, 110, 110)
LIGHT_BG = (245, 243, 240)


class ManualPDF(FPDF):
    def __init__(self, titulo_capa: str, subtitulo: str):
        super().__init__(orientation="P", unit="mm", format="A4")
        # Sanitizados só uma vez pra usar em header/footer/capa sem risco
        self.titulo_capa = titulo_capa  # setado ANTES do sanitizador — abaixo
        self.subtitulo = subtitulo
        self.pular_header = True  # não desenha header/footer na capa
        self.set_auto_page_break(auto=True, margin=20)
        self.set_margins(left=20, top=22, right=20)

    def _sanit(self, s: str) -> str:
        return sanitizar_latin1(s)

    def header(self):
        if self.pular_header:
            return
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*GRAY)
        self.cell(0, 6, "Fluxo de Peças GRISOMAQ", align="L")
        self.cell(0, 6, self._sanit(self.subtitulo), align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*BRAND_ORANGE)
        self.set_line_width(0.6)
        self.line(20, 20, 190, 20)
        self.ln(4)

    def footer(self):
        if self.pular_header:
            return
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*GRAY)
        self.cell(
            0,
            10,
            f"Página {self.page_no()} / {{nb}}",
            align="C",
        )

    def desenhar_capa(self):
        self.pular_header = True
        self.add_page()
        # Bloco laranja no topo
        self.set_fill_color(*BRAND_ORANGE)
        self.rect(0, 0, 210, 90, style="F")

        self.set_y(35)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(255, 255, 255)
        self.cell(0, 6, "FLUXO DE PEÇAS GRISOMAQ", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(6)

        self.set_font("Helvetica", "B", 30)
        self.cell(0, 14, self._sanit(self.titulo_capa), align="C", new_x="LMARGIN", new_y="NEXT")

        self.set_y(115)
        self.set_font("Helvetica", "", 14)
        self.set_text_color(*DARK)
        self.multi_cell(0, 8, self._sanit(self.subtitulo), align="C")

        self.set_y(250)
        self.set_font("Helvetica", "I", 10)
        self.set_text_color(*GRAY)
        self.cell(
            0,
            6,
            f"Gerado em {date.today().strftime('%d/%m/%Y')}",
            align="C",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.cell(0, 6, "GRISOMAQ - Sistema interno de almoxarifado", align="C")

    def iniciar_conteudo(self):
        self.pular_header = False
        self.add_page()

    def paragrafo(self, texto: str):
        self.set_font("Helvetica", "", 11)
        self.set_text_color(*DARK)
        self.multi_cell(0, 6, texto, align="J")
        self.ln(2)

    def bullet(self, texto: str):
        self.set_font("Helvetica", "", 11)
        self.set_text_color(*DARK)
        x0 = self.get_x()
        # Desenha um bullet redondo pequeno
        y = self.get_y()
        self.set_fill_color(*BRAND_ORANGE)
        self.ellipse(x0 + 2, y + 2.4, 1.6, 1.6, style="F")
        self.set_x(x0 + 7)
        self.multi_cell(0, 5.5, texto, align="L")
        self.ln(1)

    def numero(self, n: int, texto: str):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*BRAND_ORANGE)
        self.cell(8, 6, f"{n}.")
        self.set_font("Helvetica", "", 11)
        self.set_text_color(*DARK)
        self.multi_cell(0, 6, texto, align="L")
        self.ln(1)

    def h1(self, texto: str):
        # Cada H1 num novo página
        if self.page_no() > 1 and self.get_y() > 60:
            self.add_page()
        self.ln(4)
        self.set_font("Helvetica", "B", 20)
        self.set_text_color(*BRAND_ORANGE)
        self.multi_cell(0, 10, texto)
        self.set_draw_color(*BRAND_ORANGE)
        self.set_line_width(0.4)
        y = self.get_y()
        self.line(20, y, 60, y)
        self.ln(6)

    def h2(self, texto: str):
        self.ln(3)
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(*DARK)
        self.multi_cell(0, 8, texto)
        self.ln(1)

    def h3(self, texto: str):
        self.ln(2)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*GRAY)
        self.multi_cell(0, 6, texto.upper())
        self.ln(1)

    def bloco_codigo(self, texto: str):
        self.set_font("Courier", "", 9)
        self.set_text_color(*DARK)
        self.set_fill_color(*LIGHT_BG)
        self.multi_cell(0, 5, self._sanit(texto), border=0, fill=True)
        self.ln(2)


# Substituições pra latin-1: emojis e tipografia unicode -> ASCII equivalentes.
# fpdf2 com Helvetica core não aceita > U+00FF. PT-BR acentuado (á, ç, ã) cabe.
LATIN1_MAP = {
    "—": "-",   # em-dash
    "–": "-",   # en-dash
    "…": "...", # ellipsis
    "“": '"', "”": '"',
    "‘": "'", "’": "'",
    " ": " ",   # nbsp
    "→": "->", "←": "<-",
    "✓": "OK", "✗": "X",
    "⚠": "[!]",
    "⬆": "^", "⬇": "v",
    "🔴": "[!]",  # 🔴 (surrogates)
    "📄": "",
    "⊕": "+",
    "⬛": "*",
    "‑": "-",
    "→": "->",
    "↵": "",
    "⌗": "", "⌕": "",
    "⌔": "",
    "✑": "",
    "✅": "OK",
    "❌": "X",
    "⚡": "*",
    "⭐": "*",
    "⭕": "O",
    "□": "[]", "■": "[X]",
    "☐": "[ ]", "☑": "[X]",
    "⬡": "*",
    "⚛": "*",
}


def sanitizar_latin1(texto: str) -> str:
    for k, v in LATIN1_MAP.items():
        texto = texto.replace(k, v)
    # Qualquer resto fora do latin-1 vira "?"
    out = []
    for ch in texto:
        try:
            ch.encode("latin-1")
            out.append(ch)
        except UnicodeEncodeError:
            out.append("")
    return "".join(out)


def render_inline(pdf: ManualPDF, texto: str) -> str:
    """Substitui ênfases inline por texto plano + sanitiza pra latin-1."""
    import re
    texto = re.sub(r"\*\*(.+?)\*\*", r"\1", texto)
    texto = re.sub(r"(?<!\*)\*(?!\*)(.+?)\*(?!\*)", r"\1", texto)
    texto = re.sub(r"`([^`]+)`", r'"\1"', texto)
    texto = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", texto)
    return sanitizar_latin1(texto)


def parse_markdown(pdf: ManualPDF, md: str):
    """Parser simples pro nosso subset de markdown:
    # H1  ## H2  ### H3
    - bullet   1. numerado
    ```blocos de código```
    parágrafo em branco separa.
    """
    linhas = md.split("\n")
    i = 0
    n = len(linhas)
    while i < n:
        linha = linhas[i]
        # Bloco de código
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

        # Lista com bullet ("- ")
        if linha.startswith("- "):
            item = render_inline(pdf, linha[2:].strip())
            # Multi-linha (continuações indentadas)
            j = i + 1
            while j < n and (linhas[j].startswith("  ") or linhas[j].startswith("\t")):
                item += " " + render_inline(pdf, linhas[j].strip())
                j += 1
            pdf.bullet(item)
            i = j
            continue

        # Lista numerada ("N. ")
        import re
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

        # Parágrafo — junta linhas até em branco
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
    # Remove o H1 do topo do arquivo (fica só na capa)
    linhas = md.split("\n")
    while linhas and not linhas[0].startswith("# "):
        linhas.pop(0)
    if linhas:
        linhas.pop(0)  # descarta o H1 já usado como título de capa
    # Descarta linhas em branco iniciais
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


if __name__ == "__main__":
    main()
