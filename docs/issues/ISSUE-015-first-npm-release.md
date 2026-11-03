# 第一次發佈 0.3.0 到 npm

## Why
@luca-style/tokens 與 @luca-style/react 的發佈流程、閘門、npm 組織、權杖和審核環境都已就緒，但 npm 上還沒有任何版本，使用端（automated_trading）只能引用手動打包的 tarball。版本號發佈後不能重用，第一次又是不可逆的動作，所以要先發到 `next`、從真實 registry 驗證過，才讓一般安裝拿到它；同時讓 main 上的版本號與 npm 一致。

## Scope
- `publish.yml` 能選擇發佈到哪個 dist-tag。
- 發佈只發 main 上已提交的版本。
- 從 registry 安裝已發佈版本的驗證。
- 一份發佈清單：發佈、驗證、提升 latest、推 tag、發錯時怎麼辦。
- 實際把 0.3.0 發佈到 `next`，驗證後提升到 `latest`。
- automated_trading PR #54 改用 npm 上的 0.3.0。

## Promises
PR-RELEASE-01 — `publish.yml` 手動觸發時可選 dist-tag，只接受 `next` 或 `latest`，預設 `next`；兩個套件都以所選 tag 發佈。
PR-RELEASE-02 — `publish.yml` 只發佈 main 上已提交的版本：套用 changeset 會改動任何檔案時，發佈失敗，不發佈任何套件。
PR-RELEASE-03 — 有一個指令能在乾淨專案從 npm registry 安裝指定版本的兩個套件，跑與 `test:consumer` 相同的檢查（型別檢查、production build、主題與元件操作、字體與授權），並以 `npm audit signatures` 確認來源證明；不打包本機原始碼。
PR-RELEASE-04 — 發佈前，main 上兩個套件的版本都是 0.3.0，`.changeset/` 裡沒有待處理的 changeset，`CHANGELOG.md` 含 0.3.0 的內容（來自 `first-npm-release.md`）。
PR-RELEASE-05 — 發佈清單（`docs/releasing.md`）依序寫明：合併版本提交、從 main 觸發 `publish.yml` 並在環境審核核准、以 PR-RELEASE-03 驗證 `next` 上的版本、使用端驗證、以 `npm dist-tag add` 把兩個套件的 `latest` 指到該版本、推送指向發佈 commit 的 annotated tag `v<版本>`。
PR-RELEASE-06 — 發佈清單寫明發錯時的處理：不 unpublish；發新版本修正，並對壞版本執行 `npm deprecate` 附原因。
PR-RELEASE-07 — npm 上 `@luca-style/tokens` 與 `@luca-style/react` 都有 0.3.0，`latest` 與 `next` 都指向 0.3.0，且 PR-RELEASE-03 對 0.3.0 通過。
PR-RELEASE-08 — origin 上有 annotated tag `v0.3.0`，指向發佈 0.3.0 時 `publish.yml` 檢出的 commit。
PR-RELEASE-09 — automated_trading PR #54 不再引用 `vendor/` 的 tarball，改引用 npm 上的 `@luca-style/*@0.3.0`，該專案 web-frontend 的全部檢查通過。

## Out of scope
- 改用 `npm stage publish` 或信任發佈（OIDC）：npm 預計 2027 年 1 月移除繞過 2FA 的直接發佈，要在那之前另開規格處理。這次同時改發佈方式，出問題時分不清原因。
- 權杖輪替自動化：權杖到期由擁有者手動換。
- 自動產生 GitHub Release 或發佈說明頁：`CHANGELOG.md` 已有內容。
- 讓 workflow 自動提交版本或推 tag：要擴大持權杖 job 的 `contents` 權限。
- 合併 automated_trading PR #54：那是擁有者在另一個 repo 的動作；本規格只承諾它的檢查通過。
- P2 後台範本。

## Decisions
- 版本 0.3.0，沿用 `.changeset/first-npm-release.md` 與 PR-ADOPT-09；不另訂版本。
- 先發 `next`、驗證後提升 `latest`；不直接發 `latest`，因為版本號不能重用、第一次發佈不可逆。
- 版本提交在發佈前合併進 main；不讓 workflow 發佈後自己提交（要擴大權限），也不只靠手動記錄（main 與 npm 會不一致）。
- `v0.3.0` tag 由擁有者在發佈成功後手動推送；不讓 workflow 推。
- 發錯往前修並 deprecate；不 unpublish（有時間與相依限制，版本號也不能再用）。
- 這次沿用直接發佈，權杖為「publish and stage」；stage-only 與信任發佈延後（見 Out of scope）。
- PR #54 就地改用 npm 版本；不另開 PR，驗證脈絡留在同一處。
- 決策紀錄：`docs/decision-log.md` 2026-11-03「第一次發佈到 npm 的做法」。

## Open questions
- `setup-node` 的 Node 22 附帶的 npm 版本是否支援目前 `publish.yml` 的所有步驟，第一次實際執行才會知道；`publish-dry-run.yml` 已在 CI 綠，可作為間接證據。
