# 驗證 Next SSR 和 React 18

## Done when

- Next 乾淨專案可以建置。首屏沒有 hydration 錯誤，也不會閃一下日間模式（`PR-ADOPT-01`）。
- Next 專案實際用到 `Navigation` 的連結 slot，傳入 `next/link`。
- React 18 乾淨專案在不改套件程式碼的情況下，公開元件都能建置和操作時，peer 放寬到 `^18.0.0 || ^19.0.0`。否則維持 `^19.0.0`，並把原因寫進 `docs/consumer-guide.md`（`PR-ADOPT-02`）。
- 這兩個專案都由 ISSUE-002 的腳本驗證。
- 承諾已移入 `docs/capabilities/design-system.md`。

## Context

規格見 `docs/issues/ISSUE-001-npm-publish-readiness.md`。決策紀錄已定：Next SSR 沒過就先修好才發佈；React 18 只有不用改程式碼才支援，因為多支援一個舊版本，之後每次改動都要多驗一次。

## Blocked by

Blocked by: ISSUE-002, ISSUE-005, ISSUE-006

## Notes

- 檢查 `ref` 的傳法。React 19 可以把 `ref` 當一般 prop，React 18 不行。
- 也檢查 `@base-ui/react` 的 peer 是否接受 React 18。
- 檢查閃爍時要傳入 suite 呼叫 `themeInitScript`，沒傳會得到 vibrant。
- 建置通過不等於沒有 hydration 錯誤，要在瀏覽器裡讀 console。
