Status: Accepted (tool and file format amended by ADR 0008, Accepted)

# Keep one component library design file, without page frames

The design source becomes a single OpenPencil file, `docs/mockup/luca-style-library.fig`. It holds the design variables and the 23 component masters, nothing else. The two style suites are a `Suite` variable mode beside the existing `Light`/`Dark` modes, so each master exists once. Page templates are no longer drawn in a design file; the showcase site is their reference.

Consumer projects start their own mockup by copying this file, then importing their project accent. When luca-style changes, a consumer re-imports the design variables; the masters in its copy do not update by themselves.

This amends ADR 0003, which kept two suite files each carrying every page frame and its own copy of the masters.

Evidence: neither consumer project uses the luca-style design files. `automated_trading` draws in its own `docs/monitoring-platform.fig` and records that it never compared against the luca-style file; `badminton` draws in its own `docs/mockup/squadup.pen`. Agents draw each project's mockup from scratch, so the page frames in luca-style serve nobody, while the masters and variables are what a new mockup lacks. In the benchmark (`docs/research/design-system-benchmark.md`), Radix Themes and shadcn/ui keep no design file and use the site as reference; Carbon, Primer and Spectrum keep one because designers draw new screens in it.

The two-mode-group wording ("Suite" and "Mode" beside each other) did not survive contact with the tool: a node holds one mode per collection and the offline export does not resolve aliases, so variables that vary by both suite and mode cannot be split across two collections. Every variable that varies by suite or by mode therefore lives in one collection, `Suite x Mode`, with four modes (`Vibrant / Light`, `Vibrant / Dark`, `Professional / Light`, `Professional / Dark`); a variable that varies on one axis only repeats its value across the other. Switching suite and mode sets that one collection. The file has three collections: `Base`, `Device` and `Suite x Mode`. An earlier layout kept separate `Suite` and `Mode` collections beside `Suite x Mode`, which made it easy to switch one and leave the others behind (ISSUE-015). See `docs/decision-log.md`.

The split in ADR 0003 existed because one file with every page exceeded OpenPencil's 10,000-node edit limit. Without pages the file is far below it.

We considered:

- **Keep two suite files with pages.** Rejected: every master change lands twice, page frames are maintained but unused, and a comparison script is needed only to catch the duplication.
- **Keep one file but retain page frames.** Rejected: brings back the node limit and the unused frames.
- **Drop the design file entirely, as Radix and shadcn do.** Rejected: every frontend project here starts from an agent-drawn mockup that the owner reviews before code is written, so the mockup needs a component library to start from.
- **Share masters through a published OpenPencil library.** Still rejected, as in ADR 0003: publishing is a manual step agents cannot perform.

Consequences:

- Merging is only possible if the two sets of masters differ solely through bound variables. If any difference is structural, the merge stops and the two-file layout stays.
- `scripts/design/` loses the scripts that exist only for pages or for comparing two files (page splitting, pagination, relayout of page frames, master comparison).
- Spec promises about page frames and two files are retired when this lands.
- `GLOSSARY.md` entries 套系設計檔 and 畫布頁 are rewritten when this lands.
