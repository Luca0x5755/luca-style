# 比較複製原始碼和 npm 套件，並寫出路線結論

## Done when

- 後台與 CRUD 題目的複製組跑 3 次。npm 組沿用 ISSUE-013「裝 Luca Style 並附文件」的 3 次結果（`PR-EVAL-01`）。
- 更新題兩組各跑 3 次，記錄本地改動是否保留（`PR-EVAL-02`）。
- 報告依規格〈Decisions〉的門檻，逐項判定並寫明複製組是否較好（`PR-EVAL-03`）。
- `evals/results/copy-vs-npm.json` 已產生，格式至少有布林欄位 `copyBetter`。
- 複製組沒有較好時，ADR 0010 的狀態改成 `Accepted`。複製組較好時，不改狀態，把結論回報擁有者，首次發佈停止。
- 承諾已移入 `docs/capabilities/design-system.md`。

## Context

規格見 `docs/issues/ISSUE-001-npm-publish-readiness.md`，路線見 `docs/adr/0010-ship-components-through-npm-and-copy-page-templates.md`。目前沒有公開資料比較代理使用這兩種方式的效果，這是首次發佈前唯一要等的結果。

## Blocked by

Blocked by: ISSUE-013

## Notes

- ISSUE-013 同意的費用已包含這張票的 9 次。實際費用明顯超過預估時，先停下來問擁有者。
- 複製組把 `packages/react/src` 複製進專案，不安裝 `@luca-style/react`，題目文字和 npm 組相同。
- 更新題的新版是自己打包的，內含一個刻意的改動，例如修一個行為。報告要寫明這只是模擬真實升級。
- 更新題的本地改動：複製組直接改複製進來的檔案，npm 組用公開 API 或包裝做到同樣的效果。評分工具要能檢查新版改動已生效，且本地改動還在。
- 樣本小，結論只決定是否重新討論 ADR 0010，不會自動換路線。不要自行改路線。
