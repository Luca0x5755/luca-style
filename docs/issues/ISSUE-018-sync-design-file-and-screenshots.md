# 同步元件庫設計檔並重新產生截圖

Blocked by: ISSUE-017

## Done when

- 已執行 `node scripts/design/apply-variables.js`；`node scripts/design/apply-variables.js --check` 與 `scripts/design/check-masters.js` 通過，`docs/mockup/luca-style-library.fig` 的 `Suite x Mode` 四個模式中，中性色的值與程式一致（PR-FILE-16）。
- 截圖基準以 `npm run update:visual`（Docker）重新產生，`npm run test:visual` 通過（PR-STYLE-42）。
- axe 檢查沒有 serious 或 critical 違規（PR-STYLE-41）。
- `npm run screenshots` 重新產生 `docs/images/` 四張截圖，`npm run verify:screenshots` 通過，四張的頁面底色等於該組合的 `bg`（PR-STYLE-52）。
- 已在新底色上檢視四種載入動畫（`packages/react/loading/` 的 tide、square × light、dark 的 GIF），把是否有舊底色色邊的結論回報給使用者。

## Context

規格見 `docs/issues/ISSUE-016-neutral-color-redesign.md`（含載入動畫的待解問題）。改值流程見 `docs/capabilities/design-system.md` 的實作補充；設計檔規則見 ADR 0004、ADR 0007。載入動畫規格見 `docs/05_frontend_spec.md` §5.5 的內容載入動畫段落。

## Notes

- `.fig` 只能透過 OpenPencil 工具或 `scripts/design/` 的腳本處理；`Suite x Mode` 是唯一的套系與明暗集合，不要拆開。
- 截圖基準只用 Playwright 官方 Linux Docker 映像產生（`scripts/visual-docker.mjs`），不在 Windows 本機產生。
- 載入動畫 GIF 為一位元透明。若有色邊，只回報、不重新輸出；是否納入由使用者決定。
