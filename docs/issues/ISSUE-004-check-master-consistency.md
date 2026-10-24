# 撰寫母版一致性比對腳本

## Done when

- `scripts/design/check-masters.js` 比對兩個套系設計檔中的 22 個母版（名稱形如 `C/...`）。
- 母版完全相同時結束碼為 0；任何差異時結束碼非 0，並列出有差異的母版名稱。
- 用一份故意改壞的副本證明腳本會失敗。
- `docs/delivery-verification.md` 記錄執行指令與一次通過的結果。腳本註解使用繁體中文。

## Context

規格見 [ISSUE-001](ISSUE-001-split-design-source-by-suite.md)，對應 PR-FILE-05 與 PR-FILE-06 的指令部分。兩個套系設計檔各帶一份母版，改一個母版必須兩邊都改，這支腳本取代人工核對。`Library guide` 與 `00 / Canvas directory` 的共用副本也要納入比對。

## Blocked by

ISSUE-002

## Notes

- 比對內容包含結構、文字、填色、佈局與樣式屬性，不只名稱。
- 用離線 `openpencil eval`，不依賴 App 運行。
- 腳本的 Windows 修補事項見 ISSUE-002 的 Notes。
