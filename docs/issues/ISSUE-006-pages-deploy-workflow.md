# 以 GitHub Actions 驗證後部署 Pages

Blocked by: ISSUE-005

## Done when

- 新增 `.github/workflows/pages.yml`：push 到 `main` 時先執行 build、typecheck、lint 與 Playwright。
- 部署 job 依賴驗證 job；任一檢查失敗就不部署，線上樣張維持上一版。
- 部署內容為 `build:pages` 的輸出，base 為 `/luca-style/`。
- [架構 §3.1](../03_architecture_design.md) 記錄 Pages 部署方式（PR-STYLE-24 的架構部分）。
- 使用者將 repo Settings → Pages 的來源改為「GitHub Actions」後，首次工作流程成功，且 `https://luca0x5755.github.io/luca-style/` 的五個路由可開啟、不存在的網址回 404（PR-STYLE-15）。

## Context

規格見 [ISSUE-001](ISSUE-001-github-pages-readme.md)，承諾 PR-STYLE-19、PR-STYLE-15（線上驗證）、PR-STYLE-24（架構部分；前端規格部分已完成）。目前 repo 的 CI 只有 `issues-check`；這會是第一個真正擋住壞版本上線的檢查。

## Blocked by

ISSUE-005 — 需要 `build:pages` 的輸出。

## Notes

- Actions 使用明確版本，不用浮動標籤；權限只給 `pages: write` 與 `id-token: write` 等部署所需。
- Playwright 在 CI 需要 `npx playwright install --with-deps chromium`；測試使用 4173 port，CI 上無衝突。
- 這次不放 `test:consumer`：它需要網路與獨立 4174 port，放進 CI 較不穩；規格也只要求前述四項。
- 最後一項驗收必須推到 `main` 並由使用者先設定 Pages 來源，屬於外部動作；本機只能驗證 workflow 語法，完成時要明說哪些項目尚未實際驗證。
- 推送與設定 Pages 需使用者授權。
