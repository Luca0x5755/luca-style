# 讓 automated_trading PR #54 改用 npm 上的 0.3.0

## Done when
- 在 `D:\automated_trading` 的 `chore/web-luca-style-0.2.0` 分支（PR #54）上：
  - `web/frontend/package.json` 對 `@luca-style/tokens` 與 `@luca-style/react` 的引用改成 npm 上的 `0.3.0`，不再指向 `file:vendor/...tgz`；
  - `vendor/` 裡的 Luca tarball 已刪除。
- 該專案 web-frontend 的全部檢查通過：Vitest、e2e、build、lint、tsc。各項的數字貼在 PR #54 的內容裡。
- `docs/delivery-verification.md` 的 PR-RELEASE-09 一列記錄 PR #54 的 commit 與檢查結果。

## Context
規格見 `docs/issues/ISSUE-015-first-npm-release.md`（PR-RELEASE-09）。PR #54 是 draft，之前以 0.2.0 tarball 驗證通過：974 個測試、456 個 e2e。0.3.0 有不相容變更，清單在 `.changeset/first-npm-release.md`，發佈後在各套件的 `CHANGELOG.md`，例如控制項高度、`Select` 長值改為換行。要照 `docs/consumer-guide.md` 處理這些變更。

## Blocked by
Blocked by: ISSUE-019

## Notes
- 這時 0.3.0 只在 `next` 上，安裝時要寫明確的版本號 `0.3.0`，不能用 `@latest`。
- 為了 0.3.0 的不相容變更調整使用端程式，是這張議題的範圍。如果發現 Luca 本身的錯誤，要記下來回報，並照 `docs/releasing.md` 往前修，不要在使用端繞過。
- 合併 PR #54 是擁有者的動作。這張議題只負責讓它的檢查全部通過，並把 PR 轉為 ready for review。
- automated_trading 有自己的 AGENTS.md 或 CLAUDE.md 規則，進去之前先讀。
