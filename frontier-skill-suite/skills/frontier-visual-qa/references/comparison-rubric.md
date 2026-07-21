# Region-by-region comparison rubric

Divide both images into the same regions (header, nav, each card/section, footer…). Score
every region on each dimension; a region passes only when all dimensions pass.

| Dimension | What to check | How to check reliably |
|---|---|---|
| Layout | element presence, order, alignment, grid/flex structure | DOM/accessibility snapshot beats pixels |
| Spacing | margins, paddings, gaps — rhythm consistency | computed styles for exact px; screenshot for rhythm |
| Typography | family, size, weight, line-height, truncation | computed styles; screenshots lie about weight |
| Color | bg, text, borders, gradients | computed styles / extracted hex; JPEG shifts colors |
| Sizing | widths, heights, aspect ratios, icon sizes | bounding boxes via inspection |
| States | hover, focus, active, disabled, empty, loading | trigger each state, capture separately |
| Content | real vs placeholder text, iconography, imagery | snapshot text extraction |
| Responsive | target's implied breakpoint + one other width | resize, re-capture |
| Theme | light AND dark when the project has both | emulate scheme, re-capture |

## Discipline
- Compare side-by-side per region; alternate-blink or overlay if tooling allows.
- Quantify deltas ("padding 12 vs 20px"), don't vibe them ("feels tighter").
- Track a fix list ordered by visual severity (layout breaks > spacing > color nuance).
- After each fix round, re-check the regions you did NOT touch — CSS changes bleed.
- Stop condition: all regions pass, or round 5 — then report remaining deltas as a table.
