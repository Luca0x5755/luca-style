# 讓 Navigation 和 Button 能接專案的路由連結

## Done when

- `Navigation` 可以使用專案提供的連結元件。點擊時不整頁重載，目前頁面仍有 `aria-current`（`PR-STYLE-57`）。
- `Button` 可以透過公開型別渲染成連結，外觀不變，鍵盤可操作（`PR-STYLE-58`）。
- 沒傳新 prop 的既有用法行為不變。
- `DESIGN.md` 和 `llms.txt` 的元件說明已更新，`tests/agent-docs.spec.ts` 通過。
- 承諾已移入 `docs/capabilities/design-system.md`。

## Context

規格見 `docs/issues/ISSUE-001-npm-publish-readiness.md`。ADR 0010 說明為什麼要在首次發佈前打開這些限制。`automated_trading` 用了 26 個原生 `<button>`，比 Luca `Button` 的 19 個還多，部分原因就是這些限制。

## Blocked by

Blocked by: none

## Notes

- `Navigation` 的連結寫死在 `packages/react/src/data-display.tsx:3-6`。
- `Button` 的 props 已傳給 Base UI，所以 `render` 執行期可用，只是 `packages/react/src/button.tsx:3` 的型別沒有。
- 渲染成連結時，Base UI 可能需要 `nativeButton={false}`，請實測。
- `Button` 危險樣式屬於 P2，不在這張票。
- 測試從套件的公開入口匯入，不要從 `src` 內部匯入。
