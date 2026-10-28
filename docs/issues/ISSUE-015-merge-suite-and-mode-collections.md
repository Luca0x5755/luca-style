# 元件庫設計檔的套系與明暗只切一個集合

Blocked by: none

## Done when

- `Suite`、`Mode` 兩個集合的設計變數移入 `Suite x Mode`；元件庫設計檔只剩 `Base`、`Device`、`Suite x Mode` 三個集合。集合名稱與四個模式名稱（`Vibrant / Light`、`Vibrant / Dark`、`Professional / Light`、`Professional / Dark`）不變，預設模式仍是 `Vibrant / Light`。
- 集合歸屬由 `npm run generate` 決定（`variables.json` 的 `collections`），`apply-variables.js`、`apply-bindings.js` 寫入後 `--check` 通過；只依套系或只依明暗變化的變數，在四個模式各寫入對應值。
- `check-masters.js` 只設 `Suite x Mode`（與 `Device`）就能解析四種「套系 × 明暗」組合，245 個綁定屬性仍等於 `variables.json`。（PR-FILE-16）
- 在元件庫設計檔把 `Suite x Mode` 切到 `Vibrant / Dark` 與 `Professional / Dark`，母版文字沒有因為集合沒切齊而對比過低（目前只切 `Mode` 會有 15 個文字低於 4.5:1）。
- `import-accent.js` 不必改集合名稱，匯入測試仍通過。（PR-FILE-19）
- PR-FILE-18 的承諾改寫為「以 `Suite x Mode` 一個集合的四個模式切換套系與明暗」，刪掉實作補充中「五個集合、三個要一起設」那段。
- 同步改寫提到「三個集合要一起設」的文件：ADR 0007 第 13 行那段、`GLOSSARY.md`「元件庫設計檔」、前端規格 §5.5 與 §5.6 核對方式、`docs/consumer-guide.md`、`docs/adoption-prompt.md`、`docs/03_architecture_design.md`、`docs/delivery-verification.md` 的模式說明。
- `npm test`、`node --test scripts/design/*.test.js`、`openpencil lint`（0 errors、0 warnings）通過。

## Context

使用者在 App 中只把 `Mode` 切到 Dark，`Suite x Mode` 仍是 `Vibrant / Light`，主色、成功／警告／錯誤色、柔和底色留在日間，配上暗黑的底色與文字，出現大量對比警告。三個集合要一起設的原因與限制見 decision-log 2026-10-28（離線匯出不解別名）；四模式集合在離線可正常解析，所以合併不需要別名。決定見 decision-log 2026-10-29「元件庫設計檔的套系與明暗併入 Suite x Mode」。

0.2.0 尚未發布、使用端還沒有複製元件庫設計檔，所以要在 PR #4 合併前完成；之後再改集合，使用端複本的重新匯入會對不上。

## Notes

- 不做：資訊密度與元件外形的設計檔模式（之後需要時另加集合）；`check-masters.js` 的文字對比檢查（之後可做，需處理禁用狀態等例外）。
- 編號接在已刪除的 ISSUE-014 之後，避免與本分支提交訊息中的 ISSUE-001 混淆。
