# 讓 publish.yml 可選 dist-tag，且只發佈 main 上已提交的版本

## Done when
- 在 GitHub 的 Actions 頁面手動觸發 `Publish` 時，有一個 dist-tag 選項：只能選 `next` 或 `latest`，預設是 `next`。
- 兩個 `npm publish` 步驟都帶 `--tag <所選的 tag>`。
- 套用 changeset 之後，只要工作樹有任何改動，job 就失敗，兩個套件都不會發佈。
- `tests/publish-workflow.spec.ts` 有測試涵蓋以上三點，`npm test` 綠燈。
- PR-RELEASE-01、02 寫進 `docs/capabilities/design-system.md`，`docs/delivery-verification.md` 各有一列。

## Context
規格見 `docs/issues/ISSUE-015-first-npm-release.md`（PR-RELEASE-01、02）。目前 `publish.yml` 會在 CI 裡跑 `npx changeset version`，但改動不會提交，所以可能發出 main 上沒有的版本。這張議題讓 workflow 拒絕這種情況。

## Blocked by
Blocked by: none

## Notes
- 「改到檔案」的檢查要放在 `changeset version` 之後、第一個 `npm publish` 之前。例如執行 `git status --porcelain`，輸出不是空的就讓 job 失敗。
- 不能放寬現有的限制：
  - 頂層 `contents: read`。
  - job 只有 `id-token: write`。
  - `npm ci --ignore-scripts`。
  - 所有 action 都釘住完整的 SHA。
  - 閘門步驟必須在最前面。
- 既有測試已檢查以上幾點，改動之後要繼續通過。
- dist-tag 用 `workflow_dispatch.inputs`，`type: choice`。發佈指令引用 `${{ inputs.<名稱> }}`，不要讓使用者自由輸入字串。
- `publish-dry-run.yml` 也可以加上 `--tag next`，讓試跑與真正發佈的參數一致。這是選做項目。
- 測試的切入點是 workflow 檔的文字結構，沿用 `publish-workflow.spec.ts` 的 `load`、`job`、`steps` 等輔助函式，不需要連網。
