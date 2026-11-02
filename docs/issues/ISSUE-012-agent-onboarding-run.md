# 實測全新代理只靠文件接入

## Done when

- 全新的代理只靠 `docs/consumer-guide.md`，在乾淨專案接入 Luca Style，共跑 3 次（`PR-ADOPT-06`）。
- 每次的結果都記在 `evals/results/`：是否通過檢查、卡在哪裡、費用和時間。
- 報告依門檻寫明要不要補 CLI。3 次中有 2 次以上需要人介入，就要補。
- 跑的過程中發現的文件問題已修好。
- 需要補 CLI 時，另開一張議題，這張票不做 CLI。
- 承諾已移入 `docs/capabilities/design-system.md`。

## Context

規格見 `docs/issues/ISSUE-001-npm-publish-readiness.md`。決策紀錄已定：P1 不做 CLI，除非代理在實測中常接錯。

## Blocked by

Blocked by: ISSUE-009, ISSUE-011

## Notes

- `claude -p` 跑的時候沒有人在場。所以「需要人介入」的定義是：代理結束後，ISSUE-002 的檢查沒有通過。
- 沿用 ISSUE-011 的隔離方式和模型。
- 還沒發佈，所以要在題目裡告訴代理：npm 安裝指令改用打包檔。除此之外不給任何提示。
- 修過文件後，先前的結果照樣保留並標明版本。不要重跑來洗掉失敗的紀錄。
