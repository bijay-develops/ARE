#!/usr/bin/env python3
"""
One-command build of the ARE Final Project Report.

  1. make_final_data.py   consolidate measured results + render result charts
  2. build_final_pdf.py   render the PDF (and emit the heading -> page map)
  3. build_final_docx.py  render the DOCX, seeding its TOC from that map
  4. stage both deliverables in the project root

Nothing in src/ is read for anything other than reference; the engine source
tree is never modified by this build.
"""
import os, shutil, subprocess, sys

RB = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(RB)
NAME = "ARE_Final_Report"

def run(script):
    print(f"\n── {script} " + "─" * (60 - len(script)))
    subprocess.run([sys.executable, os.path.join(RB, script)], cwd=ROOT, check=True)

if "--skip-data" not in sys.argv:
    run("make_final_data.py")
run("build_final_pdf.py")
run("build_final_docx.py")

print("\n── staging " + "─" * 58)
for ext in ("pdf", "docx"):
    src = os.path.join(RB, f"{NAME}.{ext}")
    dst = os.path.join(ROOT, f"{NAME}.{ext}")
    shutil.copy(src, dst)
    print(f"  {dst}  ({os.path.getsize(dst)/1024:.0f} KB)")
print("\nFinal report built.")
