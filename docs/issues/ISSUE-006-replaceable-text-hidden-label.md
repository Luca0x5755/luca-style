# 讓狀態文字可替換，讓 Checkbox 可隱藏標籤

## Done when

- `StatusMessage` 和 `ContentState` 寫死的文字都可以替換，沒提供時維持現有文字（`PR-STYLE-59`）。
- `Checkbox` 可以隱藏標籤，輔助科技仍讀得到名稱，axe 沒有 serious 或 critical 違規（`PR-STYLE-60`）。
- `DESIGN.md` 和 `llms.txt` 的元件說明已更新，`tests/agent-docs.spec.ts` 通過。
- 承諾已移入 `docs/capabilities/design-system.md`。

## Context

規格見 `docs/issues/ISSUE-001-npm-publish-readiness.md`。ADR 0010 說明為什麼要在首次發佈前打開這些限制。

## Blocked by

Blocked by: none

## Notes

- 三個元件都在 `packages/react/src/controls.tsx`，第 74、91、95 行附近。
- 先列出兩個狀態元件所有寫死的文字，包括重試按鈕，再設計 prop。
- 隱藏標籤時，名稱仍由 `label` 提供，不要另外要求 `aria-label`。
