# 發佈清單

把 `@luca-style/tokens` 與 `@luca-style/react` 發佈到 npm 的步驟。兩個套件版本一致，下文以 `<版本>` 代表要發佈的版本（第一次發佈是 0.3.0）。做法的決策見 `docs/decision-log.md` 2026-11-03「第一次發佈到 npm 的做法」。

標有 `【僅擁有者】` 的步驟只能由 npm 組織與 GitHub 倉庫的擁有者做（環境審核、需要登入 npm 的指令、推 tag）。權杖 `NPM_TOKEN` 只存在 GitHub 的 CI 機密，不寫進任何檔案、對話或終端機紀錄；不要在本機貼上或回報權杖的值。

## 1. 合併版本提交

版本先合併進 main，再發佈。版本提交由 `npx changeset version` 產生：兩個 `package.json` 與 `package-lock.json` 是 `<版本>`，`.changeset/` 只剩 `config.json`，兩個套件目錄各有 `CHANGELOG.md`。經 PR 審查後合併進 `main`。`main` 上不能還有待處理的 changeset；有的話 `publish.yml` 套用後會改動工作樹，整個發佈失敗。

## 2. 從 main 觸發 publish.yml 發佈到 next

1. 到 GitHub 的 Actions，選 Publish 工作流程，分支選 `main`，執行 Run workflow。
2. 輸入 `tag` 選 `next`（預設值）。第一次發佈一律先發 `next`，驗證後才提升 `latest`。
3. 工作流程停在 `npm-publish` 環境等審核。【僅擁有者】在審核畫面核准；核准後 job 才開始。
4. 閘門（`evals/results/copy-vs-npm.json`）、`npm audit signatures`、建置、乾淨工作樹檢查任何一步失敗，兩個套件都不會發佈。

## 3. 驗證 next 上的版本

在乾淨的環境執行：

```
npm run test:registry -- <版本>
```

指令從 npm registry 安裝兩個套件的 `<版本>`，跑與 `npm run test:consumer` 相同的檢查，並以 `npm audit signatures` 確認來源證明。任何一項失敗，這個版本不能提升到 `latest`，改走〈發錯時的處理〉。把輸出摘要記在 `docs/delivery-verification.md`。

## 4. 使用端驗證

在 automated_trading 的 PR 上，把 `vendor/` 的 tarball 換成 `@luca-style/*@<版本>`（從 `next` 安裝），重跑 web-frontend 的全部檢查。通過才往下；沒通過就停在這裡，不提升 `latest`。

## 5. 把 latest 指到這個版本

【僅擁有者】需要登入 npm，對兩個套件各執行一次：

```
npm dist-tag add @luca-style/tokens@<版本> latest
npm dist-tag add @luca-style/react@<版本> latest
```

之後用 `npm view @luca-style/tokens dist-tags` 與 `npm view @luca-style/react dist-tags` 確認 `latest` 與 `next` 都是 `<版本>`。

## 6. 推送 annotated tag

【僅擁有者】tag 要指向發佈時 `publish.yml` 實際檢出的 commit，不是推 tag 當下的 `main`。這個 commit 可能和 `main` 現在的頂端不同。

找出這個 SHA：到 GitHub 的 Actions，開啟發佈 `<版本>` 的 Publish 執行紀錄，執行摘要頁上方的 commit 連結就是檢出的 commit；也可以展開 `actions/checkout` 步驟的紀錄，看 `git checkout` 那一行的 SHA。

```
git tag -a v<版本> <SHA> -m "<版本>"
git push origin v<版本>
```

`publish.yml` 的 `contents` 權限維持唯讀，所以 tag 由擁有者在本機推送。推完用 `git ls-remote --tags origin v<版本>` 確認遠端有這個 tag。

## 發錯時的處理

不 unpublish：已發佈的版本不撤回，npm 也不保證能撤回，使用端可能已經安裝。

1. 發新版本修正：走〈1.〉到〈6.〉，版本號往前加。
2. 【僅擁有者】對壞版本標示棄用，原因寫清楚：

```
npm deprecate @luca-style/<套件>@<版本> "<原因>"
```

兩個套件版本一致，壞版本通常兩個套件都要各執行一次。如果壞版本已經被指到 `latest`，先用 `npm dist-tag add` 把 `latest` 指回上一個好的版本，再發新版本。
