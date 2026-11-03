# Crypto Strategy Lab interface

The research workspace keeps its dark, mint-accented identity. Satwik confirmed this direction on 3 November 2026. This is a refinement of the existing tool, not a rebrand.

## Hierarchy and use

Use a platform system sans, readable labels, and tabular figures for financial values. Headings establish hierarchy without decorative overlines. Neutral panels group strategy setup and results; mint identifies actions and selections, while losses retain their labelled negative values.

Keep the default workflow visible: describe a strategy, review its exact rules, then explicitly run a historical backtest. Provider options remain available and retain their privacy explanations. Advanced execution inputs use a native disclosure with current values in its summary; fees and allocation also remain visible in the mandatory review.

The desktop workspace places strategy setup beside its report. Smaller screens stack the same content in reading order. Controls stay at least 44px high; mobile inputs use 16px text. Metadata may be smaller than body text but must remain readable. Long hashes, models, and task identifiers wrap without widening the page.

## Interaction and accessibility

- Focus the review heading when rules become available, and the report heading after a run. Do not skip the review to focus its execution action.
- Native validation must reveal an invalid field inside the execution disclosure. Errors retain their text, alert semantics, and focus target.
- Report tabs keep arrow, Home, and End keyboard navigation. Selection uses text and an underline as well as color.
- Charts size their SVG coordinate system to their actual container so axis labels remain legible on phones. A dashed benchmark and text legend distinguish both series without relying only on color.
- Press feedback is immediate; hover enhancements apply only to fine, hover-capable pointers. Motion must not delay input, and reduced-motion settings disable smooth scrolling and reveal effects.
- Retain native date, select, file, and disclosure controls; visible focus; zoom; and safe-area spacing. No animation library, external font, or new runtime dependency is required.

Application rules, datasets, cost defaults, key handling, and review invalidation remain defined by the existing implementation and specification. UI polish must not weaken those boundaries.
