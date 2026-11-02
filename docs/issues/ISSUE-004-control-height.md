# 讓操作元件的實際高度符合 control-height

## Done when

- 文字單行時，Button、Select、TextField 的實際高度等於 `control-height`，涵蓋兩種風格套系、三種資訊密度、兩種元件外形（`PR-STYLE-55`）。測試量的是瀏覽器裡的實際高度。
- 文字換行時，這些元件會長高，內容不被裁切（`PR-STYLE-56`）。
- 截圖基準已更新，更新內容寫進 commit 訊息，供 PR 揭露。
- 承諾已移入 `docs/capabilities/design-system.md`。

## Context

規格見 `docs/issues/ISSUE-001-npm-publish-readiness.md`。目前內距加行高超過 `min-height`，精簡和標準的實際高度都是 50px，規格是 40px 和 48px。決策紀錄已定：修元件，不放寬規格。

## Blocked by

Blocked by: none

## Notes

- 問題在 `packages/react/src/styles.css` 第 1 行和第 14 行。
- 寬鬆密度目前正確，不要改壞。
- `tests/visual-matrix.ts` 有現成的組合清單。
- 截圖基準用 `npm run update:visual`，它需要 Docker。Docker 不可用時，回報未驗證，不要在本機更新基準。
- 跑測試時不要設 `NO_COLOR=1`，否則 token 測試會失敗。
- `docs/design-tokens.md` 若只有換行符差異，用 `git checkout --` 還原，不要暫存。
