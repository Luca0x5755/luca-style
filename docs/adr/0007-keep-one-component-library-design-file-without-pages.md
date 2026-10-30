Status: Accepted

# Keep one component library design file, without page frames

The design source is a single Penpot export, `docs/mockup/luca-style-library.penpot`. It holds the design variables and the 23 component masters, nothing else. The two style suites and the light/dark modes are token themes (`Suite x Mode`, ADR 0008), so each master exists once. Page templates are not drawn in a design file; the showcase site is their reference.

Consumer projects start their own mockup by copying this file, then importing their project accent. When luca-style changes, a consumer re-imports the design variables; the masters in its copy do not update by themselves.

Evidence: neither consumer project uses the luca-style design file. `automated_trading` draws in its own design file and records that it never compared against the luca-style one; `badminton` draws in its own. Agents draw each project's mockup from scratch, so page frames in luca-style would serve nobody, while the masters and variables are what a new mockup lacks. In the benchmark (`docs/research/design-system-benchmark.md`), Radix Themes and shadcn/ui keep no design file and use the site as reference; Carbon, Primer and Spectrum keep one because designers draw new screens in it.

Every variable that varies by suite or by mode lives in one token theme group, `Suite x Mode`, with four themes (`Vibrant / Light`, `Vibrant / Dark`, `Professional / Light`, `Professional / Dark`); a variable that varies on one axis only repeats its value across the other. Switching suite and mode activates one theme, so one cannot be switched while leaving the other behind. `Device` is a second group and `Base` holds the constants.

We considered:

- **Two suite files with pages.** Rejected: every master change lands twice, page frames are maintained but unused, and a comparison script is needed only to catch the duplication.
- **One file with page frames.** Rejected: the frames serve nobody and make the file large.
- **No design file, as Radix and shadcn do.** Rejected: every frontend project here starts from an agent-drawn mockup that the owner reviews before code is written, so the mockup needs a component library to start from.
- **Share masters through a published library.** Rejected: publishing is a manual step agents cannot perform.

Consequences:

- Spec promises about page frames and per-suite files do not exist; the glossary has no term for them.
