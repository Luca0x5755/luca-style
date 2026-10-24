# 撰寫拆檔結構驗收腳本

## Done when

- `scripts/design/verify-split.js` 以原檔 `docs/mockup/components.fig` 為基準，比對兩個套系設計檔。
- 兩個套系設計檔的頁面 frame 名稱合計涵蓋原檔 302 個 frame 的全部名稱；沒有任何一個 frame 同時出現在兩個檔案。
- 每個頁面 frame 的節點數、文字內容與填色與原檔一致。
- 全部一致時結束碼為 0；任何不一致時結束碼非 0，並列出差異的 frame 與項目。
- 用一份故意改壞的副本（刪一個 frame、改一個填色）證明腳本會失敗，並把這個證明的指令與結果寫入 `docs/delivery-verification.md`。腳本註解使用繁體中文。

## Context

規格見 [ISSUE-001](ISSUE-001-split-design-source-by-suite.md)，對應 PR-FILE-03、PR-FILE-04。基準用 `components.fig`，因為 `.pen` 加密、腳本讀不了；所以 `components.fig` 在 ISSUE-006 之前不能刪。

## Blocked by

ISSUE-002

## Notes

- 用離線 `openpencil eval` 讀檔，不依賴 App 運行。
- 無套系的共用物件（`Library guide`、`00 / Canvas directory`、兩個文字節點）與 22 個母版不算在「不得同時出現在兩檔」之內。
- 不做逐像素比對：Pencil 與 OpenPencil 渲染器不同，結果不可靠。
- 腳本的 Windows 修補事項見 ISSUE-002 的 Notes。
