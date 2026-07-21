# Extraction method details

## Per-source extraction schema
One table per source; downstream synthesis is mechanical when every lane emits this shape:

| claim/metric | value (number + unit + period) | locator | stated-or-derived | notes |
|---|---|---|---|---|

`locator` formats: `report.pdf p.12`, `finance.xlsx Q3!C14`, `export.csv rows 1200–1340`,
`https://… §Pricing`. `stated-or-derived`: did the source assert it, or did you compute it?

## Spreadsheets
- Check for hidden sheets, filtered rows, and formula vs pasted-value cells before trusting a
  total (a SUM over a filtered range is a classic silent lie).
- Recompute key aggregates from raw rows with a script; compare to the sheet's own total and
  report any delta.
- Record the period convention (calendar vs fiscal; point-in-time vs cumulative) per metric.

## PDFs & documents
- Prefer tables over narrative for numbers; when both exist and differ, the discrepancy is a
  finding.
- Footnotes and appendices override body text (restatements, definitions, exclusions).
- Note document date and data-as-of date separately.

## Charts with no underlying data
Read off values as `approx ±`, record axis scale (log axes and truncated baselines are the
top misread causes), and never chain arithmetic on two approx readings without flagging
compounding error.

## Cross-referencing
- Normalize before comparing: same units, same period, same definition (e.g. "users" —
  registered vs active?). Definition mismatch explains most "discrepancies"; check it first.
- Keep one master comparison table; every cell keeps its locator so any conflict can be
  re-audited in seconds.

## Delegation (large source sets)
One Explore subagent per source (or source group), briefed with: the fixed question, the
schema above, and the locator format. Reject lane output that lacks locators — re-brief once,
then extract that source yourself.
