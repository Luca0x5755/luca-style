# 其餘共用元件改用 Base UI，props 保持相容

Blocked by: ISSUE-009

## Done when

- `Button`、`TextField`、`Checkbox`、`Navigation` 等有互動行為的元件，改由 Base UI 處理互動、鍵盤與焦點（沒有對應 Base UI 元件的純展示元件，如 `MetricCard`、`StatusMessage`，維持原樣並在 Notes 說明）。（PR-STYLE-38）
- 每個元件的主要操作都能只靠鍵盤完成，Playwright 逐元件驗證。（PR-STYLE-38）
- 所有元件的焦點樣式一致，都是 ISSUE-006 的雙圈。（PR-STYLE-38）
- 既有公開 props 全部仍可用；做不到的地方逐一記在本議題 Notes 供 ISSUE-014 使用。（PR-STYLE-40）
- 樣張既有測試與 `npm run test:consumer` 通過。

## Context

ADR 0006 決定所有共用元件都建在 Base UI 上。ISSUE-009 已經用 Select 確立整合方式，這張照同樣做法處理其餘元件。見 [ADR 0006](../adr/0006-build-every-component-on-base-ui.md)、[架構 §3.1](../03_architecture_design.md)、[前端規格 §5.5.2](../05_frontend_spec.md)。

## Notes

- 先列出每個元件對應的 Base UI 元件（或「無對應」），再開始改；若一個 context 做不完，按元件拆成兩張。
- 保留現有 class 名稱與 DOM 結構中使用端可能依賴的部分（例如 `data-*` 屬性）。
