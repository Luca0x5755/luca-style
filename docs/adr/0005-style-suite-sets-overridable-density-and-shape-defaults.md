Status: Accepted

# A style suite sets defaults for density and component shape, which a project may override

A project still selects exactly one style suite (ADR 0001). The suite no longer fixes information density and component shape. It supplies named default values for them, and the project may override each one on its own. Density and shape become independent axes, expressed as scale variables (for example a density scale and a radius factor) that the suite sets and the project can replace. The default accent palette works the same way, as it already does through the project accent.

This amends ADR 0001, which bundled accent, density and shape into the suite with no separate control.

Evidence from `docs/research/design-system-benchmark.md`: Radix Themes (`--scaling`, `--radius-factor`), Ant Design (`compactAlgorithm` stacked on any theme) and Spectrum (`--s2-scale`) all treat density and radius as independent axes. shadcn/ui and Park UI support the other half of ADR 0001: a project picks its style once, at setup.

We considered:

- **Keep density and shape bundled.** Rejected: a dense financial page in 「精緻活力」 or a roomier dashboard in 「精緻專業」 would need a whole second suite.
- **Drop suites and expose only free axes.** Rejected: the suite is the project's single starting choice, and it keeps the two visual characters recognisable.
- **Allow switching suites per page.** Still rejected, for the reasons in ADR 0001.

Consequences:

- `GLOSSARY.md` entries for 風格套系 and 元件外形 are rewritten when this lands.
- Existing suite values become the defaults, so a project that sets nothing sees no change.
