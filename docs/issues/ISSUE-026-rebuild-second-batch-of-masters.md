# 重建第二批母版（7 個）

Blocked by: ISSUE-025

## Done when

- 同一個檔含 `C/State/Empty`、`C/State/Error`、`C/Card/Metric`、`C/Table`、`C/Nav/Desktop`、`C/Select`、`C/Select/Open`。
- 驗收同 ISSUE-025；有陰影的母版使用 ISSUE-024 的 shadow token。
- 合計 23 個母版，名稱與 `luca-style-library.fig` 的清單逐一相符（PR-FILE-26）。

## Context

`C/Table`（14 個節點）和 `C/Select/Open`（16 個節點）是最大的兩個；`C/Table` 的 hug 版面在 `.fig` 只存預設模式，要看是否隨 theme 變。做法見 ISSUE-025。

## Blocked by

ISSUE-025

## Notes

同一個 Penpot 檔，不可與 ISSUE-025 並行。
