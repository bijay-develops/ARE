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
sudo dnf install -y inkscape            # macOS: brew install --cask inkscape
inkscape system-architecture.svg --export-type=png --export-dpi=200

# Option B — rsvg
sudo dnf install -y librsvg2-tools      # macOS: brew install librsvg
rsvg-convert -o system-architecture.png system-architecture.svg
```
Pre-exported PNGs for the report already exist in `../report-build/figs/`.

## Accuracy status (checked 2026-08-09)

**These diagrams are accurate and safe to use in the report.** Verified against the
running system:

- ✅ `system-architecture.svg` correctly shows edge-node-1/2 as **ARE engines** (not nginx
  proxies) with their own caches and published ports 8081/8082 — this matches the
  implementation, and is *more* correct than the prose in older drafts of doc 6.
- ✅ `decision-flow.svg` lists all **9 rules in the implemented order**, matching
  `src/config/strategy-rules.ts` exactly (rule 1 before rule 3; rule 5 before rule 7).

**One caption to refresh when convenient:** `decision-flow.svg` labels its input
*"RequestContext (from X-* headers)"*. Since the interactive-pages work, context also comes
from **query aliases** (`?net=`, `?device=`, …) with precedence *header > query >
inference*. Consider *"RequestContext (from X-\* headers / ?query / inference)"*.

Nothing else needs changing. Cross-check against `0_PROJECT-CONTEXT.md` §8 if in doubt.

## Edit
- **draw.io / diagrams.net** — File → Open → import the `.svg`, edit, re-export.
- Or edit the SVG XML directly (they are plain, commented markup).
