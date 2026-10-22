# 以 GitHub Pages 公開樣張並重新設計 README

Blocked by: none

## Why

專案已以 MIT 開源，但 README 仍以維護者視角撰寫，「正式預覽」實為本機 `127.0.0.1:4173`，外部讀者必須 clone、安裝、建置後才看得到樣張。樣張路由與連結寫死根路徑，無法部署在 GitHub Pages 的 `/luca-style/` 子路徑；公開元件 `Navigation` 的品牌連結也寫死 `/`，使用端部署在子路徑時同樣會失效。

## Scope

- 樣張支援部署 base path，並由 GitHub Actions 驗證後部署至 GitHub Pages。
- `Navigation` 品牌連結可由使用端指定。
- README 改為開源讀者視角，附自動產生的截圖與線上樣張連結。
- 前端規格與架構文件同步記錄 base path 與部署方式。

## Promises

PR-STYLE-15 — 樣張部署於 `https://luca0x5755.github.io/luca-style/`；設計系統入口、設計基礎、共用元件、產品介面範本、介紹頁範本五個路由可經導覽切換並顯示對應頁面。
PR-STYLE-16 — 在部署 base path 下直接開啟或重新整理五個路由任一深層網址，回應 HTTP 200 並顯示對應頁面。
PR-STYLE-17 — 部署 base path 下不存在的網址回應 HTTP 404，顯示找不到頁面（§5.3.6），並提供返回設計系統入口的主要行動。
PR-STYLE-18 — 樣張內所有內部連結、導覽與品牌連結在部署 base path 下指向該 base path 內的路由；本機開發與預覽在 `/` 下的行為不變。
PR-STYLE-19 — push 到 `main` 後，build、typecheck、lint 與 Playwright 全部通過才部署 Pages；任一失敗則不更新線上樣張。
PR-STYLE-20 — `Navigation` 接受品牌連結 `brandHref`；未提供時品牌連結為 `/`，既有使用端不需修改。
PR-STYLE-21 — README 依序包含：一句話介紹與截圖、快速開始、公開套件與文件導覽、開發與驗證、授權；附線上樣張連結，本機預覽稱為「本機預覽」。
PR-STYLE-22 — README 快速開始包含 clone、`npm ci`、`npm run dev` 及不超過 10 行的最少使用程式碼；使用端安裝細節連至使用端接入文件，不在 README 重複。
PR-STYLE-23 — 單一指令可產生精緻活力、精緻專業各自日間、暗黑共 4 張樣張截圖於 `docs/images/`；此指令不屬於 `npm test`。
PR-STYLE-24 — 前端規格路由表註明路徑相對於部署 base path（GitHub Pages 為 `/luca-style/`）；架構技術棧與交付結構記錄 Pages 部署方式。

## Out of scope

- 發布 npm 套件：仍以 tarball 交付，等 API 穩定再議。
- hash 路由：網址不美觀且與路由規格不一致。
- 英文版完整 README、CONTRIBUTING、SECURITY、CHANGELOG：其他文件為中文，待有外部貢獻者再補。
- 自訂網域：沿用 GitHub Pages 預設網址。
- 字體子集化：Noto Sans TC 約 11.94 MB，線上首次載入較慢，維持既有「不宣稱已最佳化」的限制。
- 截圖的視覺回歸比對：截圖僅供 README 展示。

## Decisions

- 部署 GitHub Pages 並讓路由支援 base path；不採僅放截圖、不採 hash 路由。
- base path 只在部署建置時設定為 `/luca-style/`，本機開發與既有測試維持 `/`；不採相對 base `./`，pathname 比對難以處理。另以 `/luca-style/` 建置執行子路徑瀏覽器驗證。
- 深層路由於建置後為五個路由各產生一份頁面（回應 200），另保留 404 頁；不採只複製 `404.html` 的回退，因其以 404 狀態回應有效頁面。
- 部署前必須通過 build、typecheck、lint 與 Playwright；不採 push 即部署。
- README 快速開始精簡並連至使用端接入文件；不採完整重寫安裝步驟，避免兩處維護。
- 截圖以 Playwright 腳本產生；不採手動截圖，避免過時。腳本不列入 `npm test`，避免截圖變動造成測試失敗。
- 404 新增「找不到頁面」頁，沿用樣張外殼與共用元件，補齊四態與 48 張 Pencil frame；不採沿用入口頁內容，也不採脫離設計系統的靜態頁。
- README 維持中文並保留開頭英文簡介；不採全英文或中英雙份。
- `Navigation` 新增 `brandHref`，預設 `/`；修正公開元件寫死根路徑的缺陷。
- 前端規格路由表路徑不改寫，僅加註相對 base path。

## Open questions

- 截圖頁面：預設為設計系統入口 1280px；若其他頁更具代表性，實作時提出並由使用者決定。
- 外部依賴：repo Settings → Pages 來源須由使用者改為「GitHub Actions」，部署才會生效。
