Status: Accepted

# Move the design source from OpenPencil `.fig` to a self-hosted Penpot file, gated by a pilot

The component library design file moves from OpenPencil to Penpot, self-hosted on the owner's machine. The repo keeps an exported `.penpot` file, which consumer projects copy, together with a normalized text dump of it that is the form reviewed and verified (decided 2026-10-30, after the pilot showed the export is an opaque zip) to start their mockup, as ADR 0007 already says for the `.fig`. The move happened only after a pilot passed (see Landed below).

The reason is stability. OpenPencil crashes in the middle of editing once its in-memory state has built up, even after ADR 0007 shrank the file far below the 10,000-node limit. The crash follows session length, not the file, so shrinking the file did not fix it. The earlier bet (decision log, 2026-10-24) that the upstream bug would be fixed did not pay off.

ADR 0004 stands in principle: the DTCG token files in `packages/tokens` stay the source of every design variable, and nobody edits variable values in the design file. Only the import channel changes. ADR 0007 is amended in file format and tool: the file holds the same variables and the same 23 masters, and `Suite x Mode` and `Device` become Penpot token themes instead of OpenPencil variable collections, as the pilot showed Penpot can express them. ADR 0003 is already superseded in layout by ADR 0007; only its tool choice is replaced.

## Pilot

Done in a scratch Penpot file with the design variables and three masters (`C/Button/Primary`, `C/State/Loading`, `C/Nav/Mobile`). Items 1 and 4 must hold. Items 2 and 3 were waived by the owner on 2026-10-30, so stability is not verified by the pilot:

1. The four `Suite x Mode` combinations and the three `Device` sizes switch by token theme and resolve the right colours.
2. One continuous MCP session of at least 500 write calls, plus at least one hour of manual editing, without a crash. The two numbers are estimates, not measured limits.
3. Browser tab memory is measured at the start and the end and levels off instead of growing with the number of edits.
4. An exported `.penpot` file can be parsed offline by a script to read master names and count.

If the pilot fails, the decision is reopened rather than falling back by default.

## Settled alongside

- Design variables: the build also emits a Penpot-importable token JSON under `docs/mockup/themes/`, imported by hand in the app. No script writes variables over MCP.
- Masters: rebuilt once through `execute_code` from `docs/mockup/themes/bindings.json` and the current `.fig`. The build script is thrown away; masters are edited in Penpot afterwards.
- Verification: how much stays in CI depends on pilot item 4. If the export parses, master names, count and variable bindings are still checked offline. If not, the token JSON is checked offline and masters are checked over MCP when they change, with the result noted in the PR.
- Retirement: `luca-style-library.fig`, the four scripts in `scripts/design/` with their tests, `fig-variables.spec.ts`, and the OpenPencil-specific files in `docs/mockup/themes/` are deleted in the same PR that lands the Penpot file. Git history keeps them.
- Setup: a document in `docs/` lists the Penpot version, the start steps and the MCP plugin install. No compose file or secret goes in the repo.

## We considered

- **Stay on OpenPencil and work around the crashes** by saving and restarting often. Not rejected outright; it is the fallback to weigh if the pilot fails.
- **Penpot cloud.** Rejected: the owner chose self-hosting.
- **Keep the Penpot file only on the server, or only link it from the repo.** Rejected: consumers could not copy a file from the repo, and the design source would have no history there.
- **Commit a generator that draws the masters.** Rejected: a script plus the Penpot file would be two sources to keep in step, which is what ADR 0003 tried to avoid.
- **Keep the `.fig` as a read-only backup.** Rejected: ADR 0003 set the precedent that a stale copy invites accidental edits.

## Consequences

- Penpot has no offline CLI like `openpencil eval`, so variables can no longer be written into the design file from a script or CI.
- The exported `.penpot` file is a binary zip whose bytes are probably not stable between two exports of the same content (zip timestamps, random thumbnail ids, hash-ordered keys), so a script writes a normalized text dump next to it with stable ordering and without the volatile fields. Review and diffs use the dump; consumers copy the `.penpot`. A check fails when the dump disagrees with the `.penpot`. The dump cannot be imported back into Penpot, so the `.penpot` is not replaceable by it.
- Shadows have no off state in Penpot. The owner accepted (2026-10-30) representing off as a shadow with zero offset, zero blur and zero opacity, driven by a shadow token.
- Glossary entries to rewrite when the Penpot file lands, in the same change (the glossary describes what is in force): 元件庫設計檔, 畫布頁 (likely retired), 設計變數. Docs that name OpenPencil or `.fig` (about 230 mentions, mostly `docs/delivery-verification.md`) move at the same time.
- `automated_trading` and `badminton` draw in their own files and are not affected, but `docs/consumer-guide.md` and `docs/adoption-prompt.md` change their starting instructions.
- The two facts the pilot must settle: whether token themes express `Suite x Mode` without the multi-collection mix-up of ISSUE-015, and whether the export parses offline.

## Landed

The Penpot file `docs/mockup/luca-style-library.penpot` and its dump are committed, the OpenPencil artifacts are retired, and the glossary and consumer docs now describe Penpot. Pilot outcome: items 1 and 4 passed; items 2 and 3 (stability) were waived by the owner on 2026-10-30, so whether Penpot is more stable than OpenPencil is still unverified. If the same crashes appear in Penpot, reopen this decision. `畫布頁` was retired from the glossary (nothing in force uses it).
