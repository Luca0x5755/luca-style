# 狀態總覽頁

Blocked by: none

## Why

開工前的審稿要從畫布移到網頁，但 repo 裡還沒有能審稿的頁面。現有範本一次只能看一種狀態，每個畫面又有很多種組合，只靠人看也不實際。ADR 0009 要用後台範本試驗這個做法，所以試驗開始前，總覽頁要先做好，也要先確認並排做得出來。

## Scope

- 在 luca-style 建立狀態總覽頁，先用 `/templates/product` 這個畫面驗證。
- 補上總覽頁的截圖與 axe 檢查。
- 在使用端文件註明元件庫設計檔暫停更新。
- 定義第一次改設計變數時，Penpot 測試要怎麼放寬。

## Promises

PR-REVIEW-01 — 狀態總覽頁在開發環境可以開啟；正式建置與 Pages 輸出不含此頁，開啟其網址會顯示找不到頁面。
PR-REVIEW-02 — 同一畫面的 Loading、Empty、Error、Success 四種狀態並排呈現在同一頁。
PR-REVIEW-03 — 切換風格套系或明暗模式時，四種狀態一起改變，其他頁面的主題設定不受影響。
PR-REVIEW-04 — 切換桌機或手機寬度時，版面按該寬度的斷點呈現。
PR-REVIEW-05 — 頁面元件不自己保存要呈現的狀態，由 props 或網址參數傳入。
PR-REVIEW-06 — 畫面使用 `@luca-style/react` 公開元件與假資料，不需要後端就能呈現四種狀態。
PR-REVIEW-07 — 全新畫面的總覽頁可以並排呈現兩個版面方向。
PR-REVIEW-08 — 納入總覽頁的畫面，每種「狀態 × 風格套系 × 明暗模式 × 寬度（1280、834、390）」組合都有截圖基準；畫面與基準不符時測試失敗。
PR-REVIEW-09 — 上述每種組合都跑 axe，沒有 serious 或 critical 等級的違規。
PR-REVIEW-10 — `docs/consumer-guide.md` 與 `docs/adoption-prompt.md` 註明元件庫設計檔在試驗期間暫停更新。
PR-REVIEW-11 — 第一次改設計變數後，`npm test` 不再因 `.penpot` 與設計變數不一致而失敗；只移出 `tests/penpot-library.spec.ts` 的第一個測試和 `scripts/design/check-penpot.test.mjs` 的 `the committed library export passes every check`，其他腳本測試留在 `npm test`。
PR-REVIEW-12 — 放寬後，`npm run check:penpot` 仍可手動執行並列出差異。`docs/capabilities/design-system.md`（含 PR-FILE-27）、`docs/delivery-verification.md`、`docs/consumer-guide.md` 的敘述都與此一致。

## Out of scope

- **後台範本和 P2 試驗：** 畫面清單屬於 P2「後台與 CRUD」，也要先完成 P0、P1。試驗規則已寫在 ADR 0009。
- **刪除元件庫設計檔：** 要等試驗通過。
- **其他專案使用總覽頁：** 試驗通過後才寫進 `docs/adoption-prompt.md`；`automated_trading` 的票也在該專案處理。
- **審稿標註工具：** 試驗期間沿用截圖加紅框。
- **接真實資料：** 範本沒有真實資料，這點要等第一個真實專案確認。

## Decisions

- 審稿面與試驗規則見 ADR 0009。
- 審稿範圍、版面方向數量和總覽頁做法見 `docs/decision-log.md` 2026-10-31。
- 先用 `/templates/product` 驗證並排，因為只有它同時有表格、指標和表單；它的狀態目前放在元件內部，要先改成由外部傳入。**不採用**一開始就導入 Storybook；如果總覽頁外殼的工夫明顯超過頁面本身，就改試 Storybook。
- 全部組合交給截圖與 axe，每個畫面是 48 種（4 狀態 × 2 套系 × 2 明暗 × 3 寬度）。**不採用**原計畫的「新場景只完整拍代表頁」，因為試驗期間使用者只審預設組合再抽查，其餘組合要靠機器把關。
- 放寬測試要等第一次改設計變數。**不採用**現在就放寬，也**不採用**移出整支 `penpot-library.spec.ts`。PR 要說明這項放寬，並跑過完整的 `npm test`。
- 總覽頁審過後保留，不隨著接真實資料而刪除。
- 分支完成時，承諾移到 `docs/capabilities/design-system.md`，再刪除本議題。PR-REVIEW-11、12 要等第一次改設計變數才做，移過去時標明尚未觸發，因為 CI 不允許議題留到分支合併後。

- 兩個版面方向先只並排 Success，選定後再看該方向的四種狀態，因為一次看 8 格太難比。**不採用**每個方向都並排四種狀態。

## Open questions
