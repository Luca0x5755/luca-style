# 把 0.3.0 提升為 latest 並結案第一次發佈

## Done when
- `npm view @luca-style/tokens dist-tags` 與 `npm view @luca-style/react dist-tags` 都顯示 `latest: 0.3.0` 與 `next: 0.3.0`。
- 在 `docs/capabilities/design-system.md` 與 `docs/delivery-verification.md`：
  - 補上 PR-RELEASE-07、08、09；
  - PR-RELEASE-01 到 09 全部都在正式文件裡。
- `docs/issues/ISSUE-015-first-npm-release.md` 已用 `git rm` 刪除。
- `release/0.3.0` 分支開了 PR。

## Context
規格見 `docs/issues/ISSUE-015-first-npm-release.md`（PR-RELEASE-07）。照 `docs/releasing.md` 的提升步驟做。決策是先發 `next`，使用端驗證過才提升 `latest`。ISSUE-020 完成就代表驗證通過。

## Blocked by
Blocked by: ISSUE-020

## Notes
- **`npm dist-tag add` 要由擁有者在自己已登入 npm 的終端執行。** 代理只提供這兩條指令：
  - `npm dist-tag add @luca-style/tokens@0.3.0 latest`
  - `npm dist-tag add @luca-style/react@0.3.0 latest`
- 擁有者執行後，代理用 `npm view` 驗證結果，不需要登入。
- 代理不碰權杖，也不登入 npm。
- 刪除 ISSUE-015 之前，用 grep 確認 PR-RELEASE-01 到 09 都已在正式文件裡，ISSUE-019 回填的開放問題也一併移過去。
- 合併這個 PR 是擁有者的動作。
