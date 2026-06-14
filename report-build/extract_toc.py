#!/usr/bin/env python3
"""Read the rendered PDF, find the printed page number of each registered
heading, and write toc_map.json (text, level, page) for the next build pass."""
import sys, re, json, subprocess

pdf, headings_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
targets = json.load(open(headings_path))

txt = subprocess.check_output(["pdftotext", "-layout", pdf, "-"]).decode("utf-8", "ignore")
pages = txt.split("\f")

def footer_label(page):
    lines = [l.strip() for l in page.splitlines() if l.strip()]
    for l in reversed(lines):
        if re.fullmatch(r"[ivxlcdm]+", l) or re.fullmatch(r"\d+", l):
            return l
    return ""

def is_toc_page(page):
    return ("TABLE OF CONTENTS" in page) or ("...." in page)

result = []
for t in targets:
    text, level = t["text"], t["level"]
    label = ""
    for page in pages:
        if is_toc_page(page):
            continue
        if any(line.strip() == text for line in page.splitlines()):
            label = footer_label(page)
            break
    result.append({"text": text, "level": level, "page": label})

json.dump(result, open(out_path, "w"), ensure_ascii=False)
print("extracted", len([r for r in result if r["page"]]), "/", len(result), "page numbers")
