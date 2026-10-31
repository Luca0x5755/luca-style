# 加註記並結案

Blocked by: ISSUE-002, ISSUE-003, ISSUE-004, ISSUE-005

## Done when

- `docs/consumer-guide.md` 和 `docs/adoption-prompt.md` 註明元件庫設計檔在試驗期間暫停更新（PR-REVIEW-10）。
- PR-REVIEW-01～12 移到 `docs/capabilities/design-system.md`，其中 11、12 標明尚未觸發。
- 同一檔案交付索引的編號範圍同步更新，納入 `PR-REVIEW-xx`。
- `docs/adr/0009-review-on-state-overview-pages-and-retire-the-design-file-after-a-trial.md` 維持 `Status: Proposed`。
- `git rm` 刪除 ISSUE-001 和本票，`npm test` 全過。

## Context

這是分支的最後一張票，規格見 `docs/issues/ISSUE-001-state-overview-page.md`。依 `docs/agents/issue-tracker.md`，議題不能留到分支合併後，所以持續有效的承諾要移進正式文件。

## Notes

- PR-REVIEW-11、12 這次不動測試，要等第一次改設計變數才做。移過去時，要連同 ISSUE-001 的做法一起寫明：只移出哪兩個測試、要更新哪些文件、PR 要說明，而且要跑完整的 `npm test`。
- ADR 0009 要等後台範本試驗有結果才改狀態，這裡只是總覽頁做好，不要改成 `Accepted`。
- 註記只寫暫停更新與 ADR 0009，不要改動元件庫設計檔的其他使用說明；設計檔在試驗期間仍然有效。
