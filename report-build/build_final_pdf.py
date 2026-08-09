#!/usr/bin/env python3
"""
Renders the ARE Final Project Report to PDF from the shared content model,
in the Cosmos College / Pokhara University BE project-report format:

  A4 portrait, Times New Roman, 12 pt body, 1.5 line spacing, justified,
  1 inch margins, 0.5 inch header/footer, lowercase roman page numbers
  (bottom centre) for front matter and arabic (bottom right) for the body,
  with the project title as a running header on body pages.

Also writes report-build/data/toc_pages.json so the DOCX build can seed the
cached result of its table-of-contents field with matching page numbers.
"""
import os, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import final_content as C

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, Image, PageBreak,
                                KeepTogether, NextPageTemplate, Preformatted)
from reportlab.platypus.tableofcontents import TableOfContents

OUT = os.path.join(HERE, "ARE_Final_Report.pdf")
FONTDIR = "/System/Library/Fonts/Supplemental"
for name, fn in [("TNR", "Times New Roman.ttf"), ("TNR-B", "Times New Roman Bold.ttf"),
                 ("TNR-I", "Times New Roman Italic.ttf"),
                 ("TNR-BI", "Times New Roman Bold Italic.ttf")]:
    pdfmetrics.registerFont(TTFont(name, os.path.join(FONTDIR, fn)))
pdfmetrics.registerFontFamily("TNR", normal="TNR", bold="TNR-B", italic="TNR-I",
                              boldItalic="TNR-BI")
for name, fn in [("CN", "Courier New.ttf"), ("CN-B", "Courier New Bold.ttf")]:
    pth = os.path.join(FONTDIR, fn)
    if os.path.exists(pth):
        pdfmetrics.registerFont(TTFont(name, pth))
MONO = "CN" if "CN" in pdfmetrics.getRegisteredFontNames() else "Courier"

LEAD = 18            # 12 pt at 1.5 line spacing
PAGELABEL = {}       # absolute page -> printed label, refreshed on every pass

def roman(n):
    vals = [(1000, "m"), (900, "cm"), (500, "d"), (400, "cd"), (100, "c"), (90, "xc"),
            (50, "l"), (40, "xl"), (10, "x"), (9, "ix"), (5, "v"), (4, "iv"), (1, "i")]
    out = ""
    for v, s in vals:
        while n >= v:
            out += s; n -= v
    return out

# ── styles ───────────────────────────────────────────────────────────────────
def S(name, **kw):
    kw.setdefault("fontName", "TNR"); kw.setdefault("fontSize", 12)
    kw.setdefault("leading", LEAD)
    return ParagraphStyle(name, **kw)

BODY   = S("body", alignment=TA_JUSTIFY, spaceAfter=8)
BODY_I = S("bodyi", alignment=TA_JUSTIFY, spaceAfter=8, fontName="TNR-I")
PLAIN  = S("plain", alignment=TA_LEFT, spaceAfter=2)
H1     = S("h1", fontName="TNR-B", fontSize=16, leading=21, spaceBefore=0, spaceAfter=10)
H2     = S("h2", fontName="TNR-B", fontSize=14, leading=19, spaceBefore=12, spaceAfter=6)
H3     = S("h3", fontName="TNR-B", fontSize=12, leading=17, spaceBefore=9, spaceAfter=5)
CAP    = S("cap", fontName="TNR-BI", fontSize=11, leading=14, alignment=TA_CENTER,
           spaceBefore=5, spaceAfter=9)
CAPT   = S("capt", fontName="TNR-BI", fontSize=11, leading=14, alignment=TA_CENTER,
           spaceBefore=8, spaceAfter=5)
CAPT.keepWithNext = True
QUOTE  = S("quote", fontName="TNR-I", fontSize=12, leading=LEAD, alignment=TA_JUSTIFY,
           leftIndent=26, rightIndent=26, spaceBefore=6, spaceAfter=10)
LIST   = S("list", alignment=TA_JUSTIFY, leftIndent=22, bulletIndent=8, spaceAfter=5)
CODE   = ParagraphStyle("code", fontName=MONO, fontSize=8.4, leading=10.6,
                        leftIndent=8, rightIndent=4, spaceBefore=2, spaceAfter=2)
CENTER = S("center", alignment=TA_CENTER, spaceAfter=3)
TCELL  = S("tcell", fontSize=10, leading=12.6, alignment=TA_LEFT, spaceAfter=0)
THEAD  = S("thead", fontSize=10, leading=12.6, alignment=TA_CENTER, fontName="TNR-B",
           spaceAfter=0)
REFP   = S("ref", alignment=TA_JUSTIFY, leftIndent=30, firstLineIndent=-30, spaceAfter=7)

def esc(t):
    return (t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))

# ── document template with three page kinds ──────────────────────────────────
class Doc(BaseDocTemplate):
    def __init__(self, path):
        super().__init__(path, pagesize=A4,
                         leftMargin=inch, rightMargin=inch,
                         topMargin=inch, bottomMargin=inch,
                         title="Adaptive Rendering Engine — Final Project Report",
                         author=", ".join(a for a, _ in C.AUTHORS))
        fw = A4[0] - 2 * inch
        fh = A4[1] - 2 * inch
        frame = Frame(inch, inch, fw, fh, id="f",
                      leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.state = {"front": 0, "body": 0}
        self.addPageTemplates([
            PageTemplate(id="cover", frames=[frame], onPage=self._cover),
            PageTemplate(id="front", frames=[frame], onPage=self._front),
            PageTemplate(id="body",  frames=[frame], onPage=self._body),
        ])

    def _reset_if_first(self, canv):
        if canv.getPageNumber() == 1:
            self.state["front"] = 0; self.state["body"] = 0

    def _cover(self, canv, doc):
        self._reset_if_first(canv)
        PAGELABEL[canv.getPageNumber()] = ""

    def _front(self, canv, doc):
        self._reset_if_first(canv)
        self.state["front"] += 1
        lbl = roman(self.state["front"])
        PAGELABEL[canv.getPageNumber()] = lbl
        canv.saveState(); canv.setFont("TNR", 11)
        canv.drawCentredString(A4[0] / 2, 0.5 * inch, lbl)
        canv.restoreState()

    def _body(self, canv, doc):
        self._reset_if_first(canv)
        self.state["body"] += 1
        lbl = str(self.state["body"])
        PAGELABEL[canv.getPageNumber()] = lbl
        canv.saveState()
        canv.setFont("TNR-I", 10)
        canv.drawRightString(A4[0] - inch, A4[1] - 0.5 * inch - 4, C.TITLE)
        canv.setFont("TNR", 11)
        canv.drawRightString(A4[0] - inch, 0.5 * inch, lbl)
        canv.restoreState()

    def afterFlowable(self, flowable):
        key = getattr(flowable, "_toc_key", None)
        if key is not None:
            lvl, txt = key
            self.notify("TOCEntry", (lvl, txt, self.page))

# ── flowable builders ────────────────────────────────────────────────────────
def head(text, style, level=None):
    para = Paragraph(esc(text), style)
    if level is not None:
        para._toc_key = (level, text)
    return para

def build_table(blk, avail):
    widths = blk["widths"]
    if widths:
        total = sum(widths)
        widths = [w / total * avail for w in widths]
    else:
        widths = [avail / len(blk["headers"])] * len(blk["headers"])
    data = [[Paragraph(esc(h), THEAD) for h in blk["headers"]]]
    for row in blk["rows"]:
        data.append([Paragraph(esc(str(c)), TCELL) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="CENTER")
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
        ("BACKGROUND", (0, 0), (-1, 0), colors.Color(.92, .92, .92)),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t

def code_block(text, avail):
    lines = text.split("\n")
    longest = max((len(l) for l in lines), default=1)
    # Courier advance width is 0.6 em; shrink just enough that the widest line fits
    size = min(8.4, (avail - 12) / (0.6 * max(longest, 1)))
    st = ParagraphStyle("code_fit", parent=CODE, fontSize=size, leading=size * 1.28)
    rows = []
    for line in lines:
        rows.append([Preformatted(line, st)] if line.strip()
                    else [Spacer(1, size * 1.28)])
    t = Table(rows, colWidths=[avail], hAlign="CENTER")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.Color(.96, .96, .96)),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.Color(.6, .6, .6)),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 0.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 0.5),
    ]))
    return t

AVAIL = A4[0] - 2 * inch

def flow_body():
    out = []
    first_h1 = True
    for blk in C.BODY:
        t = blk["t"]
        if t == "h1":
            if not first_h1:
                out.append(PageBreak())
            first_h1 = False
            out.append(head(blk["text"], H1, level=0))
        elif t == "h2":
            out.append(head(blk["text"], H2, level=1))
        elif t == "h3":
            out.append(Paragraph(esc(blk["text"]), H3))
        elif t == "p":
            out.append(Paragraph(esc(blk["text"]), BODY_I if blk.get("italic") else BODY))
        elif t == "quote":
            out.append(Paragraph(esc(blk["text"]), QUOTE))
        elif t == "bul":
            for it in blk["items"]:
                out.append(Paragraph(esc(it), LIST, bulletText="•"))
            out.append(Spacer(1, 4))
        elif t == "num":
            for i, it in enumerate(blk["items"], 1):
                out.append(Paragraph(esc(it), LIST, bulletText=f"{i}."))
            out.append(Spacer(1, 4))
        elif t == "refs":
            for i, it in enumerate(blk["items"], 1):
                out.append(Paragraph(f"[{i}]&nbsp;&nbsp;{esc(it)}", REFP))
        elif t == "code":
            out.append(code_block(blk["text"], AVAIL))
            out.append(Spacer(1, 8))
        elif t == "table":
            cap = Paragraph(esc(blk["cap"]), CAPT)
            tbl = build_table(blk, AVAIL)
            if len(blk["rows"]) > 8:          # let big tables flow, header repeats
                out.extend([cap, tbl])
            else:
                out.append(KeepTogether([cap, tbl]))
            out.append(Spacer(1, 10))
        elif t == "fig":
            from PIL import Image as PILImage
            w = blk["width"] * inch
            iw, ih = PILImage.open(blk["path"]).size
            h = w * ih / iw
            out.append(KeepTogether([Image(blk["path"], width=w, height=h),
                                     Paragraph(esc(blk["cap"]), CAP)]))
        elif t == "pb":
            out.append(PageBreak())
    return out

# ── front matter ─────────────────────────────────────────────────────────────
def cline(text, size=12, bold=False, italic=False, space=3):
    f = "TNR-BI" if (bold and italic) else "TNR-B" if bold else "TNR-I" if italic else "TNR"
    return Paragraph(esc(text), ParagraphStyle(
        "c", fontName=f, fontSize=size, leading=size * 1.35,
        alignment=TA_CENTER, spaceAfter=space))

def title_page(with_supervisor):
    s = [Spacer(1, 26)]
    s += [cline("AN ENGINEERING PROJECT REPORT", 14, True, space=6),
          cline("On", 12, space=6),
          cline(C.TITLE_UPPER, 18, True, space=26),
          cline("Submitted By", 12, True, space=8)]
    for nm, rl in C.AUTHORS:
        s.append(cline(f"{nm} – {rl}", 12, True, space=4))
    s.append(Spacer(1, 18))
    if with_supervisor:
        s += [cline("Under the Supervision of", 12, space=5),
              cline(C.SUPERVISOR, 12, True, space=24)]
    else:
        s.append(Spacer(1, 24))
    s += [cline("Submitted to", 12, True, space=5),
          cline(C.DEPARTMENT, 12, True, space=4),
          cline("In Partial fulfillment of the requirements for the degree of", 12, space=4),
          cline(C.DEGREE, 12, True, space=26),
          cline(C.COLLEGE, 12, True, space=4),
          cline(C.AFFIL, 12, space=4),
          cline(C.PLACE, 12, space=14),
          cline(C.SUBMISSION, 12, True, space=3)]
    return s

def front_matter(toc):
    f = []
    f += title_page(False)
    f += [NextPageTemplate("front"), PageBreak()]
    f += title_page(True)
    f.append(PageBreak())

    f.append(head("COPYRIGHT", H1, level=0))
    f.append(Paragraph(esc(
        "The author has agreed that the Library, Pokhara University, Cosmos College of "
        "Management & Technology, may make this engineering project report freely available for "
        "inspection. Moreover, the author has agreed that permission for extensive copying of "
        "this report for scholarly purpose may be granted by the supervisor who supervised the "
        "work recorded herein or, in their absence, by the college authority in which the "
        "project work was done. Copying or any other use of this report for financial gain "
        "without approval of the college and the author's permission is strictly prohibited."), BODY))
    f.append(Paragraph(esc(
        "Request for the permission to copy or to make any other use of the materials in this "
        "report in whole or in part should be addressed to:"), BODY))
    f.append(Spacer(1, 12))
    for line in [C.COLLEGE, C.PLACE]:
        f.append(Paragraph(esc(line), PLAIN))
    f.append(PageBreak())

    f.append(head("CERTIFICATE", H1, level=0))
    names = ", ".join(f"{n} ({r})" for n, r in C.AUTHORS[:-1])
    f.append(Paragraph(esc(
        f"The undersigned certify that they have read and recommended to the Department of ICT "
        f"and Computer Engineering, a final year project work entitled “{C.TITLE}” submitted by "
        f"{names} and {C.AUTHORS[-1][0]} ({C.AUTHORS[-1][1]}) in partial fulfillment of the "
        f"requirements for the degree of {C.DEGREE}."), BODY))
    f.append(Spacer(1, 40))
    for grp in [["_______________________________", C.SUPERVISOR, "(Project Supervisor)",
                 "Department of ICT and Computer Engineering", C.COLLEGE],
                ["_______________________________", "(External Examiner)"],
                ["_______________________________", "Head of the Department",
                 "Department of ICT and Computer Engineering", C.COLLEGE]]:
        for line in grp:
            f.append(Paragraph(esc(line), PLAIN))
        f.append(Spacer(1, 24))
    f.append(PageBreak())

    f.append(head("ACKNOWLEDGEMENT", H1, level=0))
    for t in [
        "We would like to express our sincere gratitude to our project supervisor, "
        f"{C.SUPERVISOR}, for his continuous guidance, encouragement and valuable feedback "
        "throughout the design, implementation and evaluation of the Adaptive Rendering Engine. "
        "His insistence that every claim be demonstrable shaped the evidence-first character of "
        "this work.",
        "We are equally thankful to the Department of ICT and Computer Engineering, "
        f"{C.COLLEGE}, for providing the academic environment and the resources required to "
        "carry out this project, and to our teachers and friends for their reviews and "
        "criticism at every stage.",
        "We also acknowledge the open-source communities behind Node.js, React, Docker, nginx "
        "and the wider web-performance ecosystem, whose freely available tools made it possible "
        "to build and rigorously evaluate this project entirely at zero cost. Finally, we thank "
        "our families for their constant support."]:
        f.append(Paragraph(esc(t), BODY))
    f.append(Spacer(1, 14))
    for nm, rl in C.AUTHORS:
        f.append(Paragraph(esc(f"{nm} ({rl})"), PLAIN))
    f.append(PageBreak())

    f.append(head("ABSTRACT", H1, level=0))
    for para in C.ABSTRACT:
        f.append(Paragraph(esc(para), BODY))
    f.append(PageBreak())

    f.append(Paragraph("TABLE OF CONTENTS", H1))
    f.append(toc)
    f.append(PageBreak())

    figs = [b["cap"] for b in C.BODY if b["t"] == "fig"]
    tabs = [b["cap"] for b in C.BODY if b["t"] == "table"]
    f.append(head("LIST OF FIGURES", H1, level=0))
    for t in figs:
        f.append(Paragraph(esc(t), PLAIN))
    f.append(PageBreak())
    f.append(head("LIST OF TABLES", H1, level=0))
    for t in tabs:
        f.append(Paragraph(esc(t), PLAIN))
    f.append(PageBreak())

    f.append(head("LIST OF ACRONYMS / ABBREVIATIONS", H1, level=0))
    acr = [("ARE", "Adaptive Rendering Engine"), ("SSG", "Static Site Generation"),
           ("SSR", "Server-Side Rendering"), ("CSR", "Client-Side Rendering"),
           ("ISR", "Incremental Static Regeneration"), ("EDGE_ISR", "Edge Incremental Static Regeneration"),
           ("SWR", "Stale-While-Revalidate"), ("TTFB", "Time To First Byte"),
           ("FCP", "First Contentful Paint"), ("LCP", "Largest Contentful Paint"),
           ("TTL", "Time To Live"), ("HTTP", "HyperText Transfer Protocol"),
           ("HTML", "HyperText Markup Language"), ("JSON", "JavaScript Object Notation"),
           ("NDJSON", "Newline-Delimited JSON"), ("CDN", "Content Delivery Network"),
           ("API", "Application Programming Interface"), ("SEO", "Search Engine Optimization"),
           ("UA", "User-Agent"), ("TS", "TypeScript"),
           ("ab", "ApacheBench, the Apache HTTP server benchmarking tool")]
    data = [[Paragraph(esc(a), THEAD), Paragraph(esc(b), TCELL)] for a, b in acr]
    t = Table(data, colWidths=[1.3 * inch, AVAIL - 1.3 * inch], hAlign="CENTER")
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                           ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                           ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5)]))
    f.append(t)
    f += [NextPageTemplate("body"), PageBreak()]
    return f

def main():
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle("toc0", fontName="TNR-B", fontSize=12, leading=19,
                       firstLineIndent=0, leftIndent=0, spaceAfter=1),
        ParagraphStyle("toc1", fontName="TNR", fontSize=12, leading=18,
                       firstLineIndent=0, leftIndent=24, spaceAfter=1),
    ]
    toc.dotsMinLevel = 0
    toc.formatter = lambda pg: PAGELABEL.get(pg, str(pg))

    doc = Doc(OUT)
    story = front_matter(toc) + flow_body()
    doc.multiBuild(story)

    # export the heading -> printed page map for the DOCX build
    pages = [{"text": t, "level": l, "page": PAGELABEL.get(p, str(p))}
             for (l, t, p, *_rest) in toc._entries]
    json.dump(pages, open(os.path.join(HERE, "data", "toc_pages.json"), "w"), indent=1)
    print(f"PDF written: {OUT}")
    print(f"   TOC entries: {len(pages)}")

if __name__ == "__main__":
    main()
