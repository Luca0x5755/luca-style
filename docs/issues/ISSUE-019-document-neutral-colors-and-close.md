# 寫中性色升級說明、承諾入正式文件並結案

Blocked by: ISSUE-018

## Done when

- `docs/consumer-guide.md` 的「0.2.0 升級說明」有中性色一節：列出 8 個角色的舊值與新值，並說明使用端寫死舊色碼處要改用設計變數（PR-STYLE-53）。
- `docs/capabilities/design-system.md` 的 PR-STYLE-27、PR-STYLE-29 換成 ISSUE-016 的改寫版（編號不變），並加入 PR-STYLE-48 至 PR-STYLE-54。
- `DESIGN.md`、`llms.txt` 若出現舊中性色色碼或「背景、主要表面、次級表面」等舊名稱，已改為新值與 `GLOSSARY.md` 的名稱。
- 以 `git rm` 刪除 ISSUE-016 至 ISSUE-019，與本票的實作一起提交。

## Context

規格見 `docs/issues/ISSUE-016-neutral-color-redesign.md`；議題結案流程見 `docs/agents/issue-tracker.md` 的生命週期段落。舊值見 decision-log 2026-10-29 或 `tests/fixtures/tokens-0.1.0/tokens.json`。

## Notes

- 只改說明文件與承諾，不改程式與設計變數。
- 若 ISSUE-018 回報載入動畫有色邊且使用者決定處理，先確認處理方式再結案，不要在本票自行重新輸出動畫。
