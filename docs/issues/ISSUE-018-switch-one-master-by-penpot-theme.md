# 讓一個母版在 Penpot 依 theme 切換

Blocked by: none

## Done when

- 建置輸出 Penpot 可匯入的 token JSON 到 `docs/mockup/themes/`，涵蓋 4 個 `Suite x Mode` 組合與 3 個 `Device` 尺寸。離線測試比對它與 `packages/tokens/src` 的 DTCG 值，不一致就失敗（PR-FILE-25）。
- 匯入 Penpot 暫存檔後，`C/Button/Primary` 一個母版能切換 4 個組合，解析出的色彩與 `docs/mockup/themes/variables.json` 一致（PR-FILE-20 的一部分）。

## Context

這是整條路徑最薄的一條：DTCG → token JSON → Penpot → 母版。目的是確認 token theme 能表達 `Suite x Mode`，不重演 ISSUE-015。母版結構依 `docs/mockup/themes/bindings.json` 和現有 `docs/mockup/luca-style-library.fig`。見 ISSUE-017 的 PR-FILE-20、25 與 ADR 0008。

## Blocked by

nothing

## Notes

- 兩個 theme 群組：`Suite x Mode`（4 個）和 `Device`（3 個），各啟用一個。
- 如果 theme 表達不了，停下來回報，不要硬做；這會推翻 ADR 0008 的前提。
- 用 `execute_code` 建母版的腳本是一次性的，不放進 repo。
- 暫存檔可用已連線的「嗨嗨」。
