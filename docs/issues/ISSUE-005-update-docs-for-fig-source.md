# 更新文件與註解，指向兩個套系設計檔

## Done when

- 下列檔案不再把 `components.pen` 或「唯一設計檔」當作設計稿，改指向 `components-vibrant.fig` 與 `components-professional.fig`：`README.md`、`docs/03_architecture_design.md`、`docs/05_frontend_spec.md`、`docs/adoption-prompt.md`、`docs/capabilities/design-system.md`、`docs/consumer-guide.md`、`docs/delivery-verification.md`、`apps/showcase/src/not-found.tsx` 第 7 行附近的註解。
- 提到 Pencil 的敘述改為 OpenPencil；若描述的是舊事實（例如歷史驗證紀錄），保留原文並標明當時的工具。
- `docs/decision-log.md` 新增一行，指向 ADR 0003；不改動既有各行。
- 全專案搜尋 `components.pen` 與「唯一設計檔」，剩下的出現處都是刻意保留的歷史紀錄或 ADR 0003 自身。

## Context

規格見 [ISSUE-001](ISSUE-001-split-design-source-by-suite.md)，對應 PR-FILE-07。決策見 [ADR 0003](../adr/0003-split-design-source-by-style-suite-in-fig.md)，術語見 `GLOSSARY.md` 的「套系設計檔」。

## Blocked by

ISSUE-002

## Notes

- 修改前先讀 `docs/agents/domain.md`。
- 程式註解使用繁體中文。
- 不要改 `docs/decision-log.md` 的既有行，它只能新增。
- `consumer-guide.md` 對外說明設計稿位置，措辭要讓外部專案也看得懂；套系設計檔一次只需要開一個，因為一個專案只選一套風格（ADR 0001）。
- 文件中若有引用已移除的 `.pen` 內部節點識別碼，標明需待 ISSUE-006 後才完全消失，不要在本票硬改。
