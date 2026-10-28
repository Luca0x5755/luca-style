# 加入 Base UI，Select 改為自訂選單

Blocked by: ISSUE-006

## Done when

- `@luca-style/react` 依賴 `@base-ui/react` ^1.9。
- `Select` 改用 Base UI 的 Select，選單外觀照前端規格 §5.5.2 與元件庫母版 `C/Select/Open`：與欄位同寬、在欄位下方 4px；選項高 40px；滑過用 surface-subtle；已選用 accent-soft 加粗、沒有勾號；停用選項用 muted 色並標「不可選」；圓角跟著元件外形。（PR-STYLE-39）
- 鍵盤：Enter、Space 或方向鍵開啟；方向鍵移動；Enter 選取；Esc 關閉；關閉後焦點回到欄位。Playwright 逐項驗證。（PR-STYLE-39）
- 選單在兩種套系 × 兩種明暗下顏色正確。（PR-STYLE-39）
- `Select` 的既有公開 props 仍可用；做不到相容的地方記在本議題 Notes 供 ISSUE-014 使用。（PR-STYLE-40 的 Select 部分）
- 焦點框為 ISSUE-006 的雙圈。

## Context

ADR 0006 決定所有元件改用 Base UI，Select 也換成自訂選單，因為原生下拉選單外觀和其他元件不一致。Select 是互動最複雜的元件，先做它來驗證 Base UI 整合方式，再由 ISSUE-010 處理其餘元件。見 [ADR 0006](../adr/0006-build-every-component-on-base-ui.md)、[架構 §3.1](../03_architecture_design.md)、[前端規格 §5.5.2](../05_frontend_spec.md)、元件庫設計檔的 `C/Select/Open` 母版。

## Notes

- 使用端的測試若用 `selectOption()` 操作原生 select 會壞，升級說明要寫出替代做法。
- 選單用 portal 時，要確認主題 CSS 變數仍套得到（套在 `<html>` 或 portal 容器上）。
- 不新增對話框、選單等新元件（規格 Out of scope）。
