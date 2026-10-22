# 設計系統

## 範圍

跨專案共用精緻活力、精緻專業兩套風格的設計變數、React 元件、明暗模式、樣張、頁面範本與 .pen 元件庫。

## 交付索引

- 專案介紹、截圖、快速開始、開發與驗證指令：[README](../../README.md)；線上樣張 `https://luca0x5755.github.io/luca-style/`。
- 套件安裝、公開 API、主題覆寫、字體授權與 Pencil 同步：[使用端接入](../consumer-guide.md)；跨專案執行步驟見[套用提示詞](../adoption-prompt.md)。
- 視覺、路由、頁面四態與元件要求：見下方「規格章節」；需求追溯使用 `PR-STYLE-01～24`。
- 驗收案例、矩陣、實跑結果與限制：[交付驗證](../delivery-verification.md)。

## 需求承諾

目前多個既有專案各有可用的 mockup，但配色、字體、密度及明暗模式不一致。建立一套個人設計系統，讓現有與未來專案可以保有自己的用途與品牌感，同時共用清楚的視覺、互動和可讀性規則。

- 兩種風格套系：精緻活力、精緻專業；每個專案選一套。
- 每套包含日間與暗黑模式、預設色票、元件外形與資訊密度。
- 共用的字體角色、語意狀態色、設計變數、React 元件及使用規範。
- 產品介面和介紹頁的桌面、手機範本，以及可瀏覽樣張與 .pen 元件庫。
- 既有 mockup 作為參考案例：活動、社群類產品對應精緻活力；金融、資料監控類產品對應精緻專業。

PR-STYLE-01 — 新專案可選擇精緻活力或精緻專業作為整站基準；同一專案的頁面可調整密度，但維持所選風格套系。
PR-STYLE-02 — 精緻活力提供 V2「潮汐」預設色票：日間主色 #147F82、點綴色 #DF826D；暗黑主色 #64C2BC、點綴色 #E8A18B。
PR-STYLE-03 — 精緻專業提供 P3「石墨紫」預設色票：日間主色 #625C83、點綴色 #6799B9；暗黑主色 #ABA4D7、點綴色 #8BBDD8。
PR-STYLE-04 — 日間以暖白為基底，暗黑以炭黑為基底；背景、主要表面、次級表面、文字及邊界在兩種模式都有對應角色。
PR-STYLE-05 — 專案可改用自己的強調色，且不改變語意狀態色的意思。
PR-STYLE-06 — 成功、警告和錯誤在各專案維持相同意義，並搭配文字或圖示；業務資料色由各專案另行定義。
PR-STYLE-07 — 首次開啟時明暗模式跟隨裝置設定；使用者手動切換後，下次開啟保留其選擇。
PR-STYLE-08 — 中文以 Noto Sans TC、英文以 Inter、資料數字以 IBM Plex Mono 為主要字體，並隨交付物保留必要授權資訊。
PR-STYLE-09 — 精緻活力採適中偏寬鬆密度，精緻專業採適中偏密集密度；兩者均保持清楚可讀的文字與操作範圍。
PR-STYLE-10 — 元件外形採 B「個性鮮明」；精緻活力的容器圓角 20px、操作元件圓角 16px，精緻專業採緊實邊界及小圓角。
PR-STYLE-11 — 動態效果短而克制；使用者啟用減少動態設定時，介面相應減少動畫。
PR-STYLE-12 — 共用元件涵蓋按鈕、表單、導覽、卡片、表格、狀態提示與載入、空白、錯誤狀態，並展示兩套風格及兩種明暗模式。
PR-STYLE-13 — 提供產品介面與介紹頁的桌面和手機範本，使新專案可依同一規則建立畫面。
PR-STYLE-14 — 提供可瀏覽樣張、設計變數、React 元件、.pen 元件庫及使用說明，讓後續專案可取得並沿用。

### 公開樣張與 README 承諾

專案以 MIT 開源後，樣張需讓外部讀者不必 clone 即可瀏覽，README 需以開源讀者視角撰寫。以下承諾以最終實作為準。

PR-STYLE-15 — 樣張部署於 `https://luca0x5755.github.io/luca-style/`；設計系統入口、設計基礎、共用元件、產品介面範本、介紹頁範本五個路由可經導覽切換並顯示對應頁面。
PR-STYLE-16 — 在部署 base path 下直接開啟或重新整理五個路由任一深層網址，回應 HTTP 200 並顯示對應頁面。尾斜線 `/foundations/` 與 `/foundations` 視為同一路由；GitHub Pages 對無尾斜線的目錄網址會 301 到帶尾斜線的網址。
PR-STYLE-17 — 部署 base path 下不存在的網址回應 HTTP 404，顯示找不到頁面（§5.3.6），並提供返回設計系統入口的主要行動。
PR-STYLE-18 — 樣張內所有內部連結、導覽與品牌連結在部署 base path 下指向該 base path 內的路由；本機開發與預覽在 `/` 下的行為不變。`Navigation` 的 `currentPath` 與其 `href` 同為含 base 的路徑（樣張傳 `withBase(route)`），元件才能比對出目前頁。
PR-STYLE-19 — push 到 `main` 後，build、typecheck、lint 與 Playwright 全部通過才部署 Pages；任一失敗則不更新線上樣張。工作流程為 `.github/workflows/pages.yml`，action 固定到 commit SHA。
PR-STYLE-20 — `Navigation` 接受品牌連結 `brandHref`；未提供時品牌連結為 `/`，既有使用端不需修改。
PR-STYLE-21 — README 依序包含：一句話介紹與截圖、快速開始、公開套件與文件導覽、開發與驗證、授權；附線上樣張連結，本機預覽稱為「本機預覽」。
PR-STYLE-22 — README 快速開始包含 clone、`npm ci`、`npm run dev` 及不超過 10 行的最少使用程式碼（逐字節錄自 `examples/consumer`）；使用端安裝細節連至使用端接入文件，不在 README 重複。
PR-STYLE-23 — 單一指令 `npm run screenshots` 可產生精緻活力、精緻專業各自日間、暗黑共 4 張樣張截圖於 `docs/images/`（vibrant-light、vibrant-dark、professional-light、professional-dark）；此指令不屬於 `npm test`，使用獨立 4177 port，`npm run verify:screenshots` 驗證產生結果穩定。
PR-STYLE-24 — 前端規格路由表註明路徑相對於部署 base path（GitHub Pages 為 `/luca-style/`）；架構技術棧與交付結構記錄 Pages 部署方式。

實作補充：

- 部署輸出目錄為 `apps/showcase/dist-pages`（`npm run build:pages`，base 為 `/luca-style/`），內含每個路由的 `index.html` 與 `404.html`；一般 `npm run build` 的輸出不變。
- 路由清單單一來源為 `apps/showcase/src/route-table.json`，應用路由與 `build:pages` 共用，測試比對兩者一致。
- 承諾 PR-STYLE-15 的線上部分（網址實際回應 200）需要使用者 push 到 `main` 並把 repo Settings → Pages 的來源設為「GitHub Actions」，尚未線上驗證；見[交付驗證](../delivery-verification.md#公開樣張與-readme)。

承諾沿用已核可總規格的凍結 ID 與原文（PR-STYLE-15 至 24 於公開樣張票新增，文字依最終實作補充）；無 retired 承諾。驗收證據見[交付驗證](../delivery-verification.md)。

### 交付邊界

- 本交付不直接重製或改寫既有專案的所有畫面；它們後續依各自排程採用此系統。
- 不統一專案商標、業務資料視覺化或專案專屬的資訊架構；這些仍由各專案決定。

參考 mockup 來自既有專案；採用對應不代表立即改寫。沒有待使用者裁決的產品問題；文字尺寸、行高、間距與變體以正式前端規格維護。

### 已定決策

- 選擇兩套專案級風格，而非所有專案套用相同外觀或逐頁切換風格；見 [ADR 0001](../adr/0001-select-one-style-suite-per-project.md)。
- 分離語意狀態色與業務資料色，而非共用紅綠 token；見 [ADR 0002](../adr/0002-separate-status-colors-from-domain-data-colors.md)。
- 兩套共用字體角色與元件行為，以色彩、密度與外形形成差異；不同字體家族完全分叉的方案未採用。
- 明暗模式由裝置設定起始，允許使用者覆寫並記住；固定只顯示日間的方案未採用。
- 元件外形採 B「個性鮮明」的調整版；A「細緻微差」與 C「共用骨架」未採用。

### 字體授權來源

- [Noto Sans TC：SIL Open Font License 1.1](https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE)
- [Inter：SIL Open Font License 1.1](https://github.com/rsms/inter/blob/master/misc/dist/help.txt)
- [IBM Plex：Open Font License](https://github.com/IBM/plex)

## 規格章節

- [架構 §3.1 技術棧與交付結構](../03_architecture_design.md#31-技術棧與交付結構能力設計系統)，記錄 Pages 部署方式；對應 `PR-STYLE-19`、`PR-STYLE-24`。
- [架構 §3.2 資料模型與所有權](../03_architecture_design.md#32-資料模型與所有權能力設計系統)
- [架構 §3.3 套件與主題公開合約](../03_architecture_design.md#33-套件與主題公開合約能力設計系統)
- [架構 §3.4 視覺規格與交付邊界](../03_architecture_design.md#34-視覺規格與交付邊界能力設計系統)
- [前端 §5.1 字體與響應式字級](../05_frontend_spec.md#51-字體與響應式字級能力設計系統)，包含 §5.1.1 字體角色及 §5.1.2 響應式規則；對應 `PR-STYLE-08`、`PR-STYLE-09`。
- [前端 §5.2 路由](../05_frontend_spec.md#52-路由能力設計系統)；路徑相對於部署 base path，對應 `PR-STYLE-15` 至 `PR-STYLE-18`、`PR-STYLE-24`。
- [前端 §5.3 頁面與狀態](../05_frontend_spec.md#53-頁面與狀態能力設計系統)，包含 §5.3.1 入口、§5.3.2 設計基礎、§5.3.3 共用元件、§5.3.4 產品介面範本、§5.3.5 介紹頁範本、§5.3.6 找不到頁面；對應 `PR-STYLE-12` 至 `PR-STYLE-14`。
- [前端 §5.4 共用風格角色](../05_frontend_spec.md#54-共用風格角色能力設計系統)；對應 `PR-STYLE-01` 至 `PR-STYLE-07`、`PR-STYLE-09` 至 `PR-STYLE-11`。
- [前端 §5.5 共用 Pencil 元件](../05_frontend_spec.md#55-共用-pencil-元件能力設計系統)，包含 §5.5.1 母版元件與檢視板、§5.5.2 元件變數、§5.5.3 間距與動態、§5.5.4 畫面核對；對應 `PR-STYLE-09`、`PR-STYLE-11`、`PR-STYLE-12`、`PR-STYLE-14`。
