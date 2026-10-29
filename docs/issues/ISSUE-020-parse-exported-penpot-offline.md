# 匯出 `.penpot` 並離線解析母版

Blocked by: ISSUE-018

## Done when

- 腳本能離線讀取暫存檔匯出的 `.penpot`，列出母版名稱和數量，結束碼 0；結果與 Penpot 內的實際內容一致（PR-FILE-23）。
- 如果解析不出來，記錄失敗原因，結束碼非零。

## Context

這回答 ADR 0008 留給試點的問題：驗證能不能繼續離線跑。匯出檔格式沒有現成文件，要實際解開看。見 ISSUE-017 的 PR-FILE-23、27。

## Blocked by

ISSUE-018

## Notes

- 腳本先放在 repo 外的暫存目錄或明確標示為試點用，不直接放進 `scripts/design/`；通過後在階段二才正式化。
- 匯出檔視為不受信任資料：解開到全新的空目錄，用 `python -I` 或固定入口執行，不從該目錄內執行直譯器。
