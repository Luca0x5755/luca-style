# 把中性色換成新值並通過測試

Blocked by: none

## Done when

- `packages/tokens/src/mode/light.tokens.json`、`dark.tokens.json` 的中性色 8 個角色等於 ISSUE-016 PR-STYLE-48 所列，且已執行 `npm run generate`（CSS、程式資料、`docs/design-tokens.md`、`docs/mockup/themes/variables.json` 都是新值）。
- `tests/tokens-snapshot.spec.ts` 與 `tests/fig-variables.spec.ts` 只對中性色 8 個角色放行與 0.1.0 不同的值；任何其他變數的值與 0.1.0 不同時仍失敗（PR-STYLE-27 改寫版）。
- 有測試涵蓋 PR-STYLE-49（兩個套系的中性色值相同）與 PR-STYLE-50（`text`、`muted` 對三層表面至少 4.5:1，`control-border` 至少 3:1，兩套系 × 兩模式）。
- `apps/showcase/index.html` 首屏的 `html` 底色是新 `bg`（日間 #F7F8FA、暗黑 #111317），且有測試確認首屏底色等於該模式的 `bg` token（PR-STYLE-51）。
- `npm test` 除截圖比對（`tests/visual.spec.ts`）外全部通過，包括推算角色的 PR-STYLE-33、PR-STYLE-46。

## Context

規格見 `docs/issues/ISSUE-016-neutral-color-redesign.md`；色表與角色名稱見 `docs/05_frontend_spec.md` §5.4；詞彙見 `GLOSSARY.md` 的「中性色」「表面層級」。

## Notes

- `focus-ring`、`accent-hover`、`accent-pressed` 由 `packages/tokens/build.mjs`（約第 143 行讀取中性色）交給 `packages/tokens/accent.js` 推算，不要手改；它們的新值隨 `npm run generate` 產生。
- 快照比對的 0.1.0 基準 `tests/fixtures/tokens-0.1.0/`、`tests/fixtures/fig-variables-0.1.0.json` 不改；例外清單寫在測試裡，只列這 8 個角色名稱。
- 截圖比對在本票必然失敗，由 ISSUE-018 重新產生基準。
- `docs/delivery-verification.md` 的舊色碼是當時的驗收證據，不改；`scripts/design/apply-variables.test.js` 的色碼是測試輸入，不需跟著改。
- 元件庫設計檔 `.fig` 不在本票處理（ISSUE-018）。
