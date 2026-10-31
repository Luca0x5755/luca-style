# 並排兩個版面方向

Blocked by: ISSUE-002

## Done when

- 一個畫面提供兩個方向時，總覽頁先並排兩個方向的 Success；選定一個方向後，再顯示該方向的四種狀態。
- 只有一個方向的畫面，呈現方式不變。

## Context

兌現 PR-REVIEW-07，規格見 `docs/issues/ISSUE-001-state-overview-page.md`。全新畫面要先給兩個版面方向並排選（`docs/decision-log.md` 2026-10-31）。一次看 8 格太難比，版面方向主要看 Success 就能判斷，所以先比 Success。

## Notes

- 用假的第二方向驗證，驗證內容不留在 `/templates/product`，也不進正式建置。
- 這張票不做第二個真實版面。第一個真實的全新畫面要等後台範本。
