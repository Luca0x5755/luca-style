# 新增樣張截圖指令

Blocked by: none

## Done when

- 一個 npm 指令 `npm run screenshots` 在 `docs/images/` 產生 4 張入口頁 1280px 寬的截圖：精緻活力日間、精緻活力暗黑、精緻專業日間、精緻專業暗黑。
- 指令可重複執行，結果穩定；字體已載入、動畫不影響畫面。
- 指令不屬於 `npm test`，不會因截圖變動讓測試失敗。
- 4 張圖合計大小約 1 MB 以內。

## Context

規格見 [ISSUE-001](ISSUE-001-github-pages-readme.md)，承諾 PR-STYLE-23。README 重新設計（ISSUE-008）需要展示兩套風格與明暗模式的截圖；手動截圖容易過時，所以改用腳本，樣式改了重跑即可。

## Blocked by

nothing

## Notes

- 使用現有 Playwright 與 `npm run preview`（4173 port）；先關閉該埠的其他服務。
- 套系與明暗模式以樣張頁的「風格套系」「明暗模式」選單切換。
- 截圖前等待 `document.fonts.ready`，並停用或等待動畫結束。
- 本票不改 README；截圖檔隨本票提交，供 ISSUE-008 引用。
- 預設截入口頁；若其他頁更具代表性，提出並由使用者決定，不自行改變。
