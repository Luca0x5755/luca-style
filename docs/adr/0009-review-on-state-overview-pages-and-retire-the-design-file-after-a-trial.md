Status: Proposed

# Review on state overview pages, and retire the design file only after a trial

Before code that changes a screen, layout or flow, the owner reviews a 狀態總覽頁 instead of a canvas: a dev-only page in the project, built with real components and fake data. If a trial on the back-office template passes, the 元件庫設計檔 and everything that exists only to support it are deleted. Until then ADR 0007 and ADR 0008 stay in force and nothing is deleted.

ADR 0007 rejected "no design file" because a mockup needs a component library to start from. A review surface built from real components no longer needs one, so that reason falls away only if this surface can do the job. That is what the trial tests.

Evidence, from `/research` on 2026-10-31 (the report is not kept in the repo):

- In 854 covered owner turns, the owner made 0 authored canvas edits. Commits without a transcript cannot rule out silent edits, but the owner confirmed hand edits on canvas are not needed for review.
- Of 11 requests to compare variants, 10 were in HTML, 1 came from a canvas screenshot and 0 happened on canvas.
- No consumer project uses the `.penpot` file. `automated_trading` copied its `.fig` predecessor on one branch and reported that cross-file references did not work and that instances tripped the renderer.
- Upkeep is real: `scripts/design` is 2,537 lines including fixtures, and every design variable change needs a manual import and export or a check fails.

The evidence does not show that a canvas is worse than a browser, or that reviewing before code reduces rework; no comparison was found. Whole-page review in HTML has never been tried with this owner. The trial exists because of that gap, and the owner judges it.

We considered:

- **Keep the design file and review on canvas.** Rejected unless the trial fails: the canvas's main advantages went unused while its upkeep continued.
- **Delete the design file now.** Rejected: the canvas's best remaining advantage, an overview of many rare states, has no tested replacement.
- **Stop reviewing before code.** Rejected: on first builds the reviewed design usually decided the outcome, and the review costs little whatever the medium.
- **Use Storybook for the trial.** Rejected for now: it adds a tool and dependencies, and the three documentation pages read do not cover several states side by side, which is what the trial needs. Revisit if the overview shell takes clearly more work than the page itself.

The trial:

- Scope is every back-office template screen and all four states, switchable by 風格套系, 明暗模式 and desktop or mobile width.
- It ends when the back-office template merges. Each screen needs a recorded result (approved or changed) in the P2 ticket. A missing record makes the trial invalid rather than passed, and the missing screens are reviewed again.
- It fails if the owner asks to return to the canvas to decide, or if a layout problem the page should have shown appears after code starts.
- A missed state is added to the page and recorded the first time. It fails the trial only when the same kind is missed again. A state the page does not list would not appear on a canvas by itself, so one miss does not separate the medium from the checklist. This makes the trial easier to pass, so every such miss is listed in the result.
- Data and behaviour problems do not count, because fake data cannot show them.

Until the trial ends:

- The design file is not updated, and `docs/consumer-guide.md` and `docs/adoption-prompt.md` say so.
- The Penpot comparison stays in `npm test` until the first design variable change. That change moves out only the first test in `tests/penpot-library.spec.ts` and the test at `scripts/design/check-penpot.test.mjs:412`, keeps the other script tests in `npm test`, and keeps `npm run check:penpot` as a manual command. The same change updates `docs/capabilities/design-system.md`, `docs/delivery-verification.md` and `docs/consumer-guide.md`, runs the full `npm test`, and discloses the loosening in its PR.

Consequences:

- On a pass, delete `docs/mockup/`, the Penpot scripts and tests, `check:penpot`, `docs/penpot-self-hosting.md`, the `designFileOnly` variables, the related generator options and the related `PR-FILE-xx`. Git history keeps them. Consumers' existing `.pen` and `.fig` files stay, with no forced migration, and new screens use a 狀態總覽頁.
- On a failure, keep the design file with frozen masters, catch up its updates once and restore the moved tests.
- Reusing the reviewed page components with real data is not verified by the trial, because the template has no real data. It is checked on the first real project and is not a condition for deletion: if reuse fails, pages get rewritten, and nobody needs the canvas back.
- ADR 0007, ADR 0008 and the glossary entries for 元件庫設計檔, 頁面 and 設計變數 change when a passed trial lands the deletion.
