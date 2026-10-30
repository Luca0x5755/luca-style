# 匯出並提交元件庫設計檔與 dump，離線檢查母版

Blocked by: ISSUE-023, ISSUE-026

## Done when

- 使用者匯出 `luca-style-library.penpot`；腳本產生 dump；兩者都提交進 `docs/mockup/`（PR-FILE-18、32）。
- 離線腳本讀匯出檔，檢查母版名稱與數量（23 個）與清單相符、變數綁定與 `bindings.json` 一致，差異時結束碼非零（PR-FILE-26、27）。
- 其他 theme 的解析值由 token set 算出，並與 `variables.json` 比對（PR-FILE-16）。
- 檢查接進測試套件。
- 記錄母版轉成元件後匯出表示是否改變（若能重新匯出）。

## Context

依 ISSUE-023 的 dump 產生器。`File.export` 在外掛 API 失敗，需要使用者手動匯出，做法見 `docs/delivery-verification.md` 的離線解析章節。

## Blocked by

ISSUE-023, ISSUE-026

## Notes

- 這張票要使用者在中途操作，完成時需使用者確認。
- 匯出檔視為不受信任資料。
- 母版名稱含空白斜線（`C / Button / Primary`）；比對 `.fig` 名稱前先以 `name.replace(/\s*\/\s*/g, "/")` 正規化。匯出前檔案要已由使用者改名為 `luca-style-library`（外掛 API 不能改檔名，見 ISSUE-025 結果）。
