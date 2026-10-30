Status: Accepted

# Move the design source from OpenPencil to a self-hosted Penpot file

The component library design file is a Penpot file, self-hosted on the owner's machine. The repo keeps an exported `.penpot` file, which consumer projects copy to start their mockup, together with a normalized text dump of it that is the form reviewed and verified.

The reason is stability. OpenPencil, the tool used before, crashed in the middle of editing once its in-memory state had built up, even after the file was far below its 10,000-node limit. The crash follows session length, not the file, so shrinking the file did not fix it. Whether Penpot is more stable has not been verified: the long-session stress test was waived by the owner on 2026-10-30. If the same crashes appear in Penpot, reopen this decision.

ADR 0004 holds: the DTCG token files in `packages/tokens` are the source of every design variable, and nobody edits variable values in the design file. ADR 0007 holds: the file holds the design variables and 23 masters, and `Suite x Mode` and `Device` are Penpot token themes.

## Settled alongside

- Design variables: the build emits a Penpot-importable token JSON under `docs/mockup/themes/`, imported by hand in the app. No script writes variables over the plugin API.
- Masters: built once through `execute_code` from `docs/mockup/themes/bindings.json`. The build script was thrown away; masters are edited in Penpot.
- Verification: `npm run check:penpot` reads the exported file offline and checks master names, count, variable bindings and the resolved value of every theme combination against `variables.json` and `penpot-tokens.json`.
- Setup: `docs/penpot-self-hosting.md` lists the Penpot version, the start steps and the MCP plugin install. No compose file or secret goes in the repo.

## We considered

- **Stay on the previous tool and work around the crashes** by saving and restarting often. Rejected: the crashes cost edits and the cause was upstream.
- **Penpot cloud.** Rejected: the owner chose self-hosting.
- **Keep the Penpot file only on the server, or only link it from the repo.** Rejected: consumers could not copy a file from the repo, and the design source would have no history there.
- **Commit a generator that draws the masters.** Rejected: a script plus the Penpot file would be two sources to keep in step.
- **Keep the previous tool's file as a read-only backup.** Rejected: a stale copy invites accidental edits.

## Consequences

- Penpot has no offline CLI, so variables cannot be written into the design file from a script or CI.
- The exported `.penpot` file is a binary zip whose bytes are not stable between two exports of the same content (zip timestamps, random thumbnail ids, hash-ordered keys). A script writes a normalized text dump next to it with stable ordering and without the volatile fields. Review and diffs use the dump; consumers copy the `.penpot`. A check fails when the dump disagrees with the `.penpot`. The dump cannot be imported back into Penpot, so it does not replace the `.penpot`.
- Shadows have no off state in Penpot. The owner accepted (2026-10-30) representing off as a shadow with zero offset, zero blur and zero opacity, driven by a shadow token.
- `automated_trading` and `badminton` draw in their own files and are not affected; `docs/consumer-guide.md` and `docs/adoption-prompt.md` tell consumers to start from the Penpot file.
