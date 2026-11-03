# 寫發佈清單並提交 0.3.0 版本

## Done when
- `docs/releasing.md` 存在，依序寫明：
  1. 合併版本提交；
  2. 從 main 觸發 `publish.yml`，選 `next`，並在 `npm-publish` 環境審核核准；
  3. 以 ISSUE-017 的指令驗證 `next` 上的版本；
  4. 使用端驗證；
  5. 對兩個套件執行 `npm dist-tag add @luca-style/<套件>@<版本> latest`；
  6. 推送 annotated tag `v<版本>`，指向 `publish.yml` 檢出的 commit，並說明怎麼從 Actions 執行紀錄找到這個 SHA。
- 清單寫明發錯時的處理：不 unpublish；發新版本修正；對壞版本執行 `npm deprecate @luca-style/<套件>@<版本> "<原因>"`。
- 執行 `npx changeset version` 之後：
  - 兩個 `package.json` 都是 `0.3.0`；
  - `.changeset/` 只剩 `config.json`；
  - `packages/tokens/CHANGELOG.md`、`packages/react/CHANGELOG.md` 含 0.3.0 的內容，來自 `first-npm-release.md`；
  - `package-lock.json` 同步更新。
- 再執行一次 `npx changeset version`，不會改動任何檔案。也就是 ISSUE-016 的檢查會放行。
- `npm test`、`npm run test:consumer`、`publish-dry-run.yml` 的步驟都綠燈。
- PR-RELEASE-04、05、06 寫進 `docs/capabilities/design-system.md`，`docs/delivery-verification.md` 各有一列。

## Context
規格見 `docs/issues/ISSUE-015-first-npm-release.md`（PR-RELEASE-04 到 06）。決策紀錄是 `docs/decision-log.md` 2026-11-03 的「第一次發佈到 npm 的做法」。版本先合併進 main 再發佈，發佈後由擁有者推 tag。

## Blocked by
Blocked by: ISSUE-016, ISSUE-017

## Notes
- 清單要引用 ISSUE-016 的 dist-tag 選項名稱和 ISSUE-017 的指令名稱，所以排在它們後面。
- 清單要寫明哪些步驟只能由擁有者做：
  - 環境審核的核准；
  - `npm dist-tag add`（需要擁有者登入 npm）；
  - `npm deprecate`；
  - 推 tag。
- 權杖不能出現在任何檔案或對話裡。
- 規格寫的「CHANGELOG.md」就是 changesets 在各套件目錄產生的檔案，repo 根目錄沒有 CHANGELOG。
- 既有測試可能把 `0.2.0` 或 `first-npm-release.md` 寫死，例如 `tests/changesets.spec.ts`，以及 PR-ADOPT-09、10 的相關測試。要依「已套用版本」的新狀態調整，並在 commit 訊息說明改了哪些既有測試。
- 這張議題不發佈任何東西。
