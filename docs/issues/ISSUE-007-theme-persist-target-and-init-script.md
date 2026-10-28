# ThemeProvider 可關閉偏好保存、可套到整頁，並提供防閃爍首屏腳本

Blocked by: none

## Done when

- `persist={false}` 時，`ThemeProvider` 完全不讀寫 `localStorage`（測試以攔截 storage 存取驗證）。（PR-STYLE-34）
- `persist` 預設 `true`，鍵名仍是 `luca-style-mode`；先寫入 0.1.0 格式的值再載入頁面，選擇照樣生效。（PR-STYLE-35）
- `target="document"` 時，主題屬性套在 `<html>`，頁面底色跟著明暗變化；使用端不用自己補程式。（PR-STYLE-36）
- `themeInitScript()` 回傳一段字串；放進 `<head>` 後，使用者之前選了暗黑，首次繪製就是暗黑（Playwright 在首次繪製前檢查 `<html>` 屬性或截圖）。（PR-STYLE-37）
- 樣張網站改用 `target="document"` 與 `themeInitScript()`。

## Context

兩個使用端專案都各自補寫了「主題套到整頁」和「防閃爍」程式，這張把它們收進設計系統。合約見 [架構 §3.3](../03_architecture_design.md) 的 `ThemeProviderProps` 與 `themeInitScript`；決策見 decision-log 2026-10-28（保存可關閉、整頁主題與防閃爍）。

## Notes

- 首屏腳本不能依賴 React 或任何 import；它是內嵌字串，要和 `ThemeProvider` 用同一個鍵名與屬性名（抽成共用常數）。
- `target="document"` 卸載時要清掉 `<html>` 上的屬性。
- 不做 SSR 支援（規格 Out of scope）。
- 升級說明要列出使用端可以刪掉的自補程式，草稿寫在本議題 Notes 供 ISSUE-014 使用。
