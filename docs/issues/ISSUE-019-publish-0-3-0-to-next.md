# 發佈 0.3.0 到 next，從 registry 驗證，並推 v0.3.0 tag

## Done when
- `npm view @luca-style/tokens dist-tags` 與 `npm view @luca-style/react dist-tags` 都顯示 `next: 0.3.0`。
- ISSUE-017 的指令對 0.3.0 執行通過，包含 `npm audit signatures`。輸出摘要記在 `docs/delivery-verification.md`，對應 PR-RELEASE-07 的 `next` 部分。
- origin 上有 annotated tag `v0.3.0`，指向這次 `publish.yml` 執行時檢出的 commit。對應 PR-RELEASE-08。

## Context
規格見 `docs/issues/ISSUE-015-first-npm-release.md`（PR-RELEASE-07、08），步驟照 `docs/releasing.md` 做。這張議題要在 ISSUE-016 到 018 所在的 PR 合併進 main **之後**才能做，並在新分支 `release/0.3.0` 上完成。

## Blocked by
Blocked by: ISSUE-018（且它所在的 PR 已合併進 main）

## Notes
- **代理在這幾處停下來，交給擁有者：**
  - 觸發 workflow 時選 `next`，可以由代理用 `gh workflow run publish.yml -f <輸入>=next` 觸發，但要先問擁有者。
  - 在 `npm-publish` 環境按核准。
  - 推送 `v0.3.0` tag：代理可以準備好指令，由擁有者決定是否執行。
- npm 權杖不得出現在對話、檔案或指令裡。這台機器沒有登入 npm，`npm view` 不需要登入。
- workflow 失敗時，先看是哪一步失敗。如果版本已經發佈了一半（例如 tokens 成功、react 失敗），不要 unpublish，照 `docs/releasing.md` 的往前修處理，並在議題記錄。
- 規格的開放問題：Node 22 附的 npm 版本能否完成所有步驟。第一次執行的結果要回填到 ISSUE-015 的 Open questions。
- 這張議題不碰 `latest`。
