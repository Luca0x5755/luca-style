# 重建第一批母版（13 個）到元件庫設計檔

Blocked by: ISSUE-024

## Done when

- Penpot 檔（先重新命名為 `luca-style-library`）含 `C/Button/Secondary`、`C/Button/Hover`、`C/Button/Focus`、`C/Button/Disabled`、`C/Button/Loading`、`C/Field/Default`、`C/Field/Focus`、`C/Field/Error`、`C/Field/Disabled`、`C/Status/Success`、`C/Status/Warning`、`C/Status/Error`、`C/Checkbox`。
- 每個母版的綁定與 `docs/mockup/themes/bindings.json` 一致，4 組合 × 3 尺寸的解析值與 `variables.json` 一致。
- 母版名稱與現有 `luca-style-library.fig` 相同（PR-FILE-26）。

## Context

做法見 ISSUE-018、019 在 `docs/delivery-verification.md` 的試點章節：theme 模型、`toggleActive` 與 `applyToken` 的注意事項、`font-zh` 要以不帶屬性的 `applyToken` 綁成 `fontFamily`。規格見 ISSUE-017 的 PR-FILE-18、26。

## Blocked by

ISSUE-024

## Notes

- 建置用的一次性腳本不進 repo。
- 母版現在是 board，不是 component；先照 board，轉換問題留給 ISSUE-027 匯出後觀察。
- 結果寫進 `docs/delivery-verification.md` 的 Penpot 章節。
