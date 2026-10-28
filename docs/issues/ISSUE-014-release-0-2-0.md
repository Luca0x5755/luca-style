# 發布 0.2.0 並寫升級說明

Blocked by: ISSUE-002, ISSUE-003, ISSUE-004, ISSUE-005, ISSUE-006, ISSUE-007, ISSUE-008, ISSUE-009, ISSUE-010, ISSUE-011, ISSUE-012, ISSUE-013

## Done when

- `@luca-style/tokens`、`@luca-style/react` 版本為 0.2.0。（PR-STYLE-44）
- `docs/consumer-guide.md` 有升級說明：列出使用端可刪除的自補程式（整頁主題、防閃爍），`accent` 新舊寫法對照，可能要調整的測試（例如 Select 不再是原生 select），以及 ISSUE-006、007、009、010 Notes 記下的不相容處。（PR-STYLE-44）
- ISSUE-001 的 Promises 移入 `docs/capabilities/design-system.md` 的需求承諾；PR-FILE-01～05、10～13、15 改為 retired 並附一行原因（PR-FILE-11 的母版綁定由 PR-FILE-18 承接）。
- ADR 0004、0005、0006、0007 的狀態改為 Accepted。
- `GLOSSARY.md` 補上或更新「風格套系」「元件外形」「專案強調色」等這次改變意思的術語（ISSUE-004 已處理的除外）。
- `npm run build`、`npm test`、`npm run typecheck`、`npm run lint`、`npm run test:consumer` 全部通過。
- 以 `git rm` 刪除 ISSUE-001 與本議題。

## Context

這是 0.2.0 升級的收尾。依 [issue tracker 規則](../agents/issue-tracker.md)，完成時把持續有效的規格移入正式文件，再刪除議題。規格見 [ISSUE-001](ISSUE-001-design-system-0-2-0.md)；兩個使用端專案的升級不在範圍內，由它們各自開議題。

## Notes

- changesets 延後，不在這張加入（decision-log 2026-10-28）。
- 刪除議題前，確認 ISSUE-001 的 Decisions 都已在 ADR 或 decision-log 有紀錄。
