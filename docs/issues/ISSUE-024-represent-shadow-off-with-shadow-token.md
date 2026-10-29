# 用 shadow token 表示陰影開關

Blocked by: none

## Done when

- 建置輸出的 token JSON 含 shadow token：開為原陰影值，關為零偏移、零模糊、透明度 0（PR-FILE-33）。
- 離線測試比對該 token 與 DTCG 來源的值。
- 在 Penpot 暫存檔把 token 套到一個有陰影的母版，4 種 Suite x Mode 的解析結果與 `docs/mockup/themes/variables.json` 的陰影設定一致。

## Context

`elevation-enabled` 是布林，Penpot 沒有此型別，試點未輸出。使用者已接受用零值陰影表示關（ADR 0008、ISSUE-017 的 PR-FILE-33）。

## Blocked by

nothing

## Notes

- 先找出哪些母版綁了陰影，把名單寫進 ISSUE-025、026 的 Notes。
- Penpot 套 shadow token 的 API 屬性（`shadow`）沒有試過；套不上就停下回報。
