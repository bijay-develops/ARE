# Diagrams

Architecture diagrams for the report and viva. Provided as **SVG** (vector —
crisp at any size, editable in any browser/Inkscape/draw.io).

| File | Shows |
| --- | --- |
| `system-architecture.svg` | Client → proxy → origin + 2 edges + Redis; engine internals |
| `decision-flow.svg` | The 9-rule decision flow (first match wins) |
| `rendering-pipeline.svg` | Per-request pipeline: analyze → decide → render → respond → measure |
| `data-flow.svg` | Level-1 DFD: entities, processes, data stores and the data moving between them |
| `data-flow.mmd` | Mermaid source for `data-flow.svg` (edit on mermaid.live, re-export) |

## View
Open any `.svg` in a web browser, or in VS Code (it previews SVG natively).

## Export to PNG (for Word/PDF reports)
```bash
# Option A — Inkscape
sudo dnf install -y inkscape
inkscape system-architecture.svg --export-type=png --export-dpi=200

# Option B — ImageMagick / rsvg
sudo dnf install -y librsvg2-tools
rsvg-convert -o system-architecture.png system-architecture.svg
```

## Edit
- **draw.io / diagrams.net** — File → Open → import the `.svg`, edit, re-export.
- Or edit the SVG XML directly (they are plain, commented markup).
