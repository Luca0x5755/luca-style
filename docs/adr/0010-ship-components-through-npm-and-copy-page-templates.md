Status: Accepted

# Ship components through npm and copy page templates into projects

Components and themes ship as versioned npm packages. 頁面範本 are source files copied into a project, which then owns them. Luca Style does not depend on shadcn and does not run a component registry. Projects that also use shadcn keep 風格套系 and 明暗模式, and handle 資訊密度 and 元件外形 themselves.

This is only worth doing if the package stops forcing projects to rebuild components. So before the first publish, the public API gains what projects cannot get today: a link slot on `Navigation`, a typed `render` on `Button`, replaceable text in `StatusMessage` and `ContentState`, and a hidden label on `Checkbox`. New features such as a danger `Button` or partial `colSpan` in `DataTable` wait until the back-office template needs them.

Evidence, from the P0 trial on `automated_trading` and `/research` on 2026-11-01 (neither report is kept in the repo):

- shadcn failed with theme changes alone. Using `shadcn@2.3.0` on Tailwind v3, all 24 combinations of 風格套系, 明暗模式, 資訊密度 and 元件外形 failed on hard-coded classes. Changing 8 classes made all 24 pass, but that means editing generated files.
- The current shadcn registry does not remove the problem. In all 27 styles, `Button` height, table padding, and focus ring width and structure are still written as classes. This comes from reading the source; nothing was run.
- An unlayered stylesheet targeting `data-slot` could override those classes, but by reading the source it misses `Button` elements whose `data-slot` is replaced, and it beats classes passed by the caller. It is also untested.
- shadcn has no update command, three-way merge or record of the installed version. Keeping local changes relies on an agent merging by hand, with no published success rate.
- Mantine, Material UI and Chakra ship components through npm and templates as copied source. Tremor did too, then moved its components to copied source without publishing why. Other systems put page-level code on npm (Toolpad Core, ProComponents, Docus).
- `automated_trading` made no edits to Luca source, and its two trial upgrades to 0.2.0 changed no production page and 13 and 9 test files. ADR-011 in that project banned forking from the start, so this does not show that editing was unnecessary. It uses 26 raw `<button>` elements against 19 Luca `Button` uses.
- The claim that pages change more often than components did not hold up: most of the gap came from file age. Lines changed per file do differ (median 123 for pages, 25 for shared components), on data from before adoption. npm also has real upgrade costs: Chakra v3's migration guide has 57 sections.

No published measurement compares how agents do with copied source and with npm packages. This decision has no such data behind it, so the P0 evals add that comparison, and the first npm publish waits for the result.

We considered:

- **Own registry, copying components into projects.** Rejected: every upgrade becomes a merge in every project, and no tool records what was installed.
- **Current shadcn with a Luca adapter stylesheet.** Rejected: it depends on selectors that miss elements, and it still leaves copied files with no upgrade path.
- **npm for everything, including templates.** Rejected for now: a template is a starting point that projects are expected to change, and a package would make Luca responsible for every customisation it lacks.
- **npm for components and no templates.** Rejected: the goal is a base for most frontend scenes, and that needs starting pages.

What would reopen this decision:

- The evals show copied source doing better. That means no quality measure gets worse and at least one clearly improves, and it includes a task where an agent updates a component to a new version and must keep local changes. Each group runs at least 3 times, which is a small sample, so a win reopens the discussion and does not change the route by itself.
- With these API additions in place, the back-office template still needs components forked in order to work.
- A second real project barely changes its templates, which would argue for putting them on npm.
- Templates break on every release of the public API they depend on.

Consequences:

- Copied templates do not update themselves. Each records the Luca version it came from, and release notes list template changes, so a project decides whether to follow.
- Templates may use the public API only, and a test enforces this.
- The public API becomes a promise. Until 1.0, a breaking change raises the minor version and comes with upgrade notes.
- How templates get copied is decided in P2, with the first template. P1 ships no CLI; see `docs/decision-log.md` for the condition that would bring one in.
