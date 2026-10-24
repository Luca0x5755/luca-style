Status: Accepted

# Split the design source by style suite and make OpenPencil `.fig` the source of truth

The design source is two OpenPencil files, one per style suite: `docs/mockup/components-vibrant.fig` and `docs/mockup/components-professional.fig`. Each holds every page frame of its suite plus its own copy of the 22 component masters. The Pencil `components.pen` is deprecated and removed from the working tree once both files are verified; git history keeps it.

This overturns the 2026-10-19 decision to keep all pages and masters in one `components.pen`.

The single-file layout cannot be edited by agents any more. The migrated `.fig` holds about 11,500 nodes, and OpenPencil's MCP refuses atomic edits on any document over 10,000 nodes, counted across the whole document rather than per page. Splitting by suite gives about 5,800 nodes per file. A suite is the natural seam: ADR 0001 makes a project pick exactly one suite, so no project needs both files open at once.

We considered:

- **Keep one `.fig` and edit it by hand in the app.** Rejected: it forfeits agent editing, which was the reason for the migration.
- **Share the masters through an OpenPencil library.** Rejected: consumers link to a library by revision and update manually, with no live sync, so it recreates the cross-file sync problem the 2026-10-19 decision avoided. It also depends on a manual publish step that agents cannot perform.
- **Split by page.** Deferred, not rejected: it would leave more headroom for projects with many pages and will be studied separately.
- **Keep `.pen` as a frozen archive.** Rejected: a stale copy invites accidental edits.

Consequences:

- The 22 masters exist twice. A change to a master must land in both files, and a script run through the offline `openpencil` CLI compares the two sets and runs as part of delivery verification.
- Splitting is done offline with `openpencil eval`, because deleting thousands of nodes inside the running app crashes its renderer.
- Documents that name `components.pen` or call it the single design file are updated in the same change that lands the split.
- Converting `.pen` to `.fig` flattens the theme variables to their default-theme values, so Dark pages and the Professional palette are lost in the converted file. The themes are rebuilt in OpenPencil as variable collections with modes (Light and Dark, plus the three device sizes) and bound to the nodes, instead of baking resolved colours into the nodes. The suite axis needs no modes because each file carries one suite. The `.pen` values are saved as JSON under `docs/mockup/themes/` before the `.pen` is deleted, because later verification compares against them.
- Visual QA stays a manual check, as before. Verification of the split is structural: frame names, node counts and text match a saved baseline (`docs/mockup/themes/baseline.json`), colours are checked against the saved resolved values, and a person looks at representative frames.
