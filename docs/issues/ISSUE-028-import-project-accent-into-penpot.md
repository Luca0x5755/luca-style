# 使用端匯入專案強調色到 Penpot

Blocked by: none

## Done when

- 腳本由專案主色（與選填的暗黑主色、點綴色、柔和底色）產生一份 Penpot 可匯入的強調色 token JSON，值與 `deriveAccent` 的結果一致。
- 離線測試比對；在 Penpot 暫存檔匯入後，母版顯示該強調色（PR-FILE-19）。

## Context

`scripts/design/import-accent.js` 靠 OpenPencil 離線 CLI，Penpot 沒有等價路徑。這是建議的做法、不是使用者已決定的：改為產生 token JSON，由使用端在 Penpot 內手動匯入。規格見 ISSUE-017 的 PR-FILE-19。

## Blocked by

nothing

## Notes

- 若使用者選別的做法，這張票要改。
- 使用說明文件放在 ISSUE-030。
