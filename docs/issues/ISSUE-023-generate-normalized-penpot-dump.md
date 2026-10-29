# 產生並檢查 `.penpot` 的正規化文字 dump

Blocked by: none

## Done when

- 腳本讀 `.penpot` 產生文字 dump：排序固定，不含時間戳、隨機縮圖 id 等易變欄位；同一份匯出檔連續產生兩次，輸出位元組相同（PR-FILE-32）。
- 檢查模式比對已提交的 dump 與 `.penpot`，不一致時結束碼非零並列出差異。
- 測試用手工縮小的 fixture，不提交真實匯出檔。

## Context

把 `scripts/penpot-pilot/parse-export.mjs` 與 `read-zip.mjs` 正式化，移到 `scripts/design/`。易變欄位清單見 `docs/delivery-verification.md` 的「能否提交進 repo」。規格見 ISSUE-017 的 PR-FILE-32，決定見 ADR 0008。

## Blocked by

nothing

## Notes

- 匯出檔視為不受信任資料，沿用試點的記憶體上限與純文字處理。
- 只觀察過一次匯出，「兩次匯出位元組不同」是推論；若有機會，請使用者再匯出一次實測。
- 試點腳本移走時，保留它的 19 個測試。
