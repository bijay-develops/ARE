#!/usr/bin/env python3
"""Iterative two-pass build: render -> read page numbers -> rebuild TOC until
the page map is stable, then leave the final DOCX + PDF in the project root."""
import os, sys, json, shutil, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RB = os.path.join(ROOT, "report-build")
DOCX = os.path.join(RB, "ARE_MidTerm_Report.docx")
PDF = os.path.join(RB, "ARE_MidTerm_Report.pdf")
HEAD = os.path.join(RB, "headings.json")
TMAP = os.path.join(RB, "toc_map.json")
NEWMAP = os.path.join(RB, "new_map.json")

def build(use_toc):
    env = os.environ.copy()
    if use_toc and os.path.exists(TMAP):
        env["TOC_JSON"] = TMAP
    else:
        env.pop("TOC_JSON", None)
    subprocess.run([sys.executable, os.path.join(RB, "build_report.py")],
                   cwd=ROOT, env=env, check=True)

def convert():
    if os.path.exists(PDF):
        os.remove(PDF)
    subprocess.run(["soffice", "--headless", "--convert-to", "pdf",
                    "--outdir", RB, DOCX], cwd=ROOT, check=True, timeout=180,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def extract():
    subprocess.run([sys.executable, os.path.join(RB, "extract_toc.py"), PDF, HEAD, NEWMAP],
                   cwd=ROOT, check=True)
    return json.load(open(NEWMAP))

prev_pages = None
for i in range(1, 5):
    build(use_toc=os.path.exists(TMAP))
    convert()
    newmap = extract()
    pages = [e["page"] for e in newmap]
    print(f"  iter {i}: pages = {pages[:6]} ...")
    if prev_pages == pages and os.path.exists(TMAP):
        print(f"converged at iteration {i}")
        break
    shutil.copy(NEWMAP, TMAP)
    prev_pages = pages

# stage DOCX only; PDF is built separately after approval
shutil.copy(DOCX, os.path.join(ROOT, "ARE_MidTerm_Report.docx"))
stage_pdf = "--with-pdf" in sys.argv
root_pdf = os.path.join(ROOT, "ARE_MidTerm_Report.pdf")
if stage_pdf:
    shutil.copy(PDF, root_pdf)
    print("FINAL DOCX + PDF staged in project root.")
else:
    if os.path.exists(root_pdf):
        os.remove(root_pdf)   # remove stale PDF until approval
    print("FINAL DOCX staged in project root (PDF deferred until approval).")
