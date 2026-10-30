# 設計系統

## 範圍

跨專案共用精緻活力、精緻專業兩套風格的設計變數、React 元件、明暗模式、樣張、頁面範本與元件庫設計檔（Penpot 匯出檔 .penpot，只含設計變數與母版）。

## 交付索引

- 專案介紹、截圖、快速開始、開發與驗證指令：[README](../../README.md)；線上樣張 `https://luca0x5755.github.io/luca-style/`。
- 套件安裝、公開 API、主題覆寫、字體授權與設計變數同步：[使用端接入](../consumer-guide.md)；跨專案執行步驟見[套用提示詞](../adoption-prompt.md)。
- 視覺、路由、頁面四態與元件要求：見下方「規格章節」；需求追溯使用 `PR-STYLE-01～54` 與 `PR-FILE-xx`（元件庫設計檔；編號沿用，已移除的編號不再使用）。
- 驗收案例、矩陣、實跑結果與限制：[交付驗證](../delivery-verification.md)。

## 需求承諾

目前多個既有專案各有可用的 mockup，但配色、字體、密度及明暗模式不一致。建立一套個人設計系統，讓現有與未來專案可以保有自己的用途與品牌感，同時共用清楚的視覺、互動和可讀性規則。

- 兩種風格套系：精緻活力、精緻專業；每個專案選一套。
- 每套包含日間與暗黑模式、預設色票、元件外形與資訊密度。
- 共用的字體角色、語意狀態色、設計變數、React 元件及使用規範。
- 產品介面和介紹頁的桌面、手機範本，以及可瀏覽樣張與元件庫設計檔（`luca-style-library.penpot`，Penpot 元件庫）。
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
PR-STYLE-14 — 提供可瀏覽樣張、設計變數、React 元件、元件庫設計檔（Penpot 元件庫）及使用說明，讓後續專案可取得並沿用。

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
PR-FILE-06 — `docs/delivery-verification.md` 記錄 Penpot 版元件庫設計檔的檢查指令與結果，並記錄人眼抽查結果。

實作補充：

- 部署輸出目錄為 `apps/showcase/dist-pages`（`npm run build:pages`，base 為 `/luca-style/`），內含每個路由的 `index.html` 與 `404.html`；一般 `npm run build` 的輸出不變。
- 路由清單單一來源為 `apps/showcase/src/route-table.json`，應用路由與 `build:pages` 共用，測試比對兩者一致。
- 元件庫設計檔的變數資料 `docs/mockup/themes/variables.json` 由 `npm run generate` 自 `packages/tokens/src` 的 DTCG 原始檔產生（ADR 0004），內容是程式變數與只給設計檔用的變數的聯集；程式與設計檔名稱不同者沿用設計檔名稱（例如 `accent-secondary` 在設計檔叫 `secondary`，對照寫在原始檔的 `$extensions["luca-style"].designName`），只給設計檔用的變數標 `designFileOnly`，不進公開的 css 與 data。改值流程：改原始檔 → `npm run generate` → 在 Penpot 內更新 token 並重新匯出元件庫設計檔 → `npm run check:penpot`；`tests/penpot-library.spec.ts` 在 `npm test` 內執行該檢查，設計檔與產生的變數資料不一致就失敗。
- 承諾 PR-STYLE-15 的線上部分（網址實際回應 200）需要使用者 push 到 `main` 並把 repo Settings → Pages 的來源設為「GitHub Actions」，尚未線上驗證；見[交付驗證](../delivery-verification.md#公開樣張與-readme)。

承諾沿用已核可總規格的凍結 ID 與原文（PR-STYLE-15 至 24 於公開樣張票新增，文字依最終實作補充）。PR-FILE 編號沿用，已移除的編號不再使用。驗收證據見[交付驗證](../delivery-verification.md)。

### 0.2.0 承諾

依[對標研究](../research/design-system-benchmark.md)補上四個缺口：設計變數只有一份正本、專案強調色從一個主色推算整組角色、資訊密度與元件外形可單獨覆寫、無障礙與截圖比對自動檢查；設計檔改為一份不含頁面的元件庫設計檔，共用互動元件改用 Base UI。中性色 8 個角色重新設計為兩套系共用的冷藍灰（decision-log 2026-10-29），併入 0.2.0。以 0.2.0 發布，升級說明見[使用端接入](../consumer-guide.md#020-升級說明)。

**設計變數**

PR-STYLE-25 — 設計變數的原始檔使用 DTCG 格式，每個變數都附用途說明。
PR-STYLE-26 — 任一「風格套系 × 明暗模式」組合缺少任何變數的值時，建置失敗並指出缺的是哪個變數。
PR-STYLE-27 — `@luca-style/tokens` 的 css、data、typography 三種輸出：既有變數的名稱、結構和值都與 0.1.0 相同；例外是中性色 8 個角色的值，改為 PR-STYLE-48 所列，其餘任何變數的值與 0.1.0 不同時快照測試失敗。
PR-STYLE-28 — 建置會產生一份設計變數規格文件，列出每個變數在每種組合下的值和用途，給代理閱讀。

**元件庫設計檔**

PR-FILE-16 — 程式產生的設計變數匯入元件庫設計檔後，每種「套系 × 明暗」組合的值都與程式一致。
PR-FILE-17 — 元件庫設計檔的 Select 母版有「選單展開」狀態。
PR-FILE-18 — 元件庫設計檔只有一份，是 repo 內的 Penpot 匯出檔（另附其正規化文字 dump，見 PR-FILE-32），內容是設計變數與 23 個母版（含 `C/Select/Open`），以 token theme 切換套系與明暗；母版的填色、描邊、字型、圓角綁定設計變數；沒有頁面 frame。
PR-FILE-19 — 使用端複製元件庫設計檔並匯入自己的強調色後，母版顯示該強調色；`docs/consumer-guide.md` 記錄此步驟，以及 luca-style 更新後如何重新匯入設計變數。

**密度與外形**

PR-STYLE-29 — 專案沒有覆寫時，資訊密度與元件外形沿用所選風格套系的預設值，密度與外形與 0.1.0 相同；中性色依 PR-STYLE-48。
PR-STYLE-30 — 專案可以單獨覆寫資訊密度，色彩與元件外形不受影響。
PR-STYLE-31 — 專案可以單獨覆寫元件外形，色彩與資訊密度不受影響。

**專案強調色**

PR-STYLE-32 — 專案強調色只有日間主色必填；暗黑主色、點綴色、柔和底色有給就用，沒給才由系統推算。風格套系的主色、點綴色、柔和底色維持人工設計值。
PR-STYLE-33 — 自動產生的強調色角色（含滑過、按下），在日間與暗黑都通過現有的文字對比門檻。
PR-STYLE-45 — 滑過與按下色由主色推算：色相不變，日間比主色深、暗黑比主色亮，按下的變化幅度大於滑過。
PR-STYLE-46 — 所有元件的焦點框為雙圈：內圈表面色、外圈主色；焦點框與底色的對比至少 3:1。
PR-STYLE-47 — 專案沒給點綴色時，點綴色沿用主色，不另外產生新色相。

**中性色**

PR-STYLE-48 — 中性色在日間／暗黑的值為：`bg` #F7F8FA／#111317、`surface` #FFFFFF／#1A1D22、`surface-subtle` #F1F3F5／#23272D、`text` #2C2E31／#EFF1F5、`muted` #696B6F／#AEB0B4、`border` #E0E2E6／#3C3E41、`control-border` #85878B／#6F7175、`accent-ink` #FFFFFF／#111317。
PR-STYLE-49 — 中性色 8 個角色在精緻活力與精緻專業的值相同，只隨明暗模式變化。
PR-STYLE-50 — 兩個套系、日間與暗黑：`text`、`muted` 對 `bg`、`surface`、`surface-subtle` 的對比都至少 4.5:1；`control-border` 對這三層都至少 3:1。
PR-STYLE-51 — 樣張在 React 掛載前的首次繪製，頁面底色就是該明暗模式的 `bg`。
PR-STYLE-52 — `docs/images/` 的四張 README 截圖（套系 × 明暗）頁面底色等於該組合的 `bg`。
PR-STYLE-53 — `docs/consumer-guide.md` 的 0.2.0 升級說明列出中性色 8 個角色的舊值與新值，並說明使用端寫死舊色碼處要改成設計變數。
PR-STYLE-54 — `docs/05_frontend_spec.md` 的色表與 PR-STYLE-48 一致，三層使用「頁面底色、卡片表面、次要表面」的名稱。

**主題控制**

PR-STYLE-34 — `ThemeProvider` 可以關閉明暗偏好保存。關閉時完全不讀寫瀏覽器儲存。
PR-STYLE-35 — 開啟保存時，鍵名仍是 `luca-style-mode`；0.1.0 存下的選擇在 0.2.0 照樣有效。
PR-STYLE-36 — `ThemeProvider` 可以把主題屬性套在 `<html>` 上，頁面底色跟著主題變化，使用端不必自己補程式。
PR-STYLE-37 — 提供現成的首屏腳本：使用者之前選了暗黑，首次繪製就是暗黑，不會先閃一下日間。

**元件**

PR-STYLE-38 — 所有共用元件改由 Base UI 處理互動行為。每個元件的主要操作都能只靠鍵盤完成，焦點樣式在所有元件一致。
PR-STYLE-39 — Select 改用自訂選單，選單外觀跟著風格套系與明暗模式；可以用鍵盤開啟、選擇、關閉。
PR-STYLE-40 — 既有元件的公開 props 在 0.2.0 保持相容；做不到的地方逐一寫進升級說明。

**品質與文件**

PR-STYLE-41 — 樣張的每一頁、每種風格套系、每種明暗模式都跑 axe 檢查，沒有 serious 或 critical 等級的違規；其餘等級列在報告中。
PR-STYLE-42 — 樣張的每一頁、每種風格套系、每種明暗模式都有截圖基準；畫面與基準不符時測試失敗。
PR-STYLE-43 — 提供 `llms.txt` 與 `DESIGN.md`，說明套件、主題軸、元件與設計變數的用法。

**發布**

PR-STYLE-44 — 以 0.2.0 發布。`docs/consumer-guide.md` 有升級說明，列出使用端可以刪除的自補程式，以及可能需要調整的測試（例如 Select）。

實作補充與已知缺口：

- 母版的自動排版尺寸、陰影開關與載入圖片透明度沒有綁定欄位，只存預設模式（Vibrant／Light）的值；Professional 的 hug 版面（指標卡、表格）因此要靠 Penpot 內重排。切換模式後的版面未驗證。
- 強調色推算的取捨（對比檢查只用於推算出的角色、`focus-ring` 角色、反向位移、`accent-ink` 固定）見 decision-log 2026-10-28。
- 中性色改值後，快照測試（`tests/tokens-snapshot.spec.ts`）只放行中性色 8 個角色，而且這 8 個必須等於 PR-STYLE-48；其餘變數仍與 0.1.0 快照逐值比對。
- 截圖比對的預設 pixelmatch 門檻偵測不到中性色這類小幅改值，所以 `tests/visual-config.spec.ts` 另外檢查每張截圖基準的左上角等於該明暗模式的 `bg`。改色後用 `npm run update:visual -- --all` 改寫全部基準，只跑 `npm run update:visual` 不會更新低於門檻的差異。
- `npm run verify:screenshots` 檢查四張 README 截圖的四角等於該組合的 `bg`（PR-STYLE-52）。
- 載入動畫 GIF 只有一位元透明，中性色改值後已在新底色上檢視：邊緣是硬邊、沒有舊底色的色邊，未重新輸出。

### Penpot 元件庫設計檔（ADR 0008）

設計稿工具是自架 Penpot（ADR 0008）。自架說明見[Penpot 自架說明](../penpot-self-hosting.md)；Penpot 長時間編輯的穩定度沒有驗證。

PR-FILE-23 — 匯出的 `.penpot` 能由腳本離線解析出母版名稱與數量。

PR-FILE-25 — 建置輸出一份 Penpot 可匯入的 token JSON 到 `docs/mockup/themes/`，涵蓋四種 `Suite x Mode` 組合與三種 `Device` 尺寸，值與 `packages/tokens/src` 的 DTCG 來源一致；離線測試在任何不一致時失敗。
PR-FILE-26 — 元件庫設計檔的 23 個母版名稱與 `docs/mockup/themes/bindings.json` 的清單相同，沒有遺漏或新增。
PR-FILE-27 — 離線腳本讀取匯出檔檢查母版名稱、數量與變數綁定，在任何差異時回報非零結束碼並列出差異，且納入測試或 CI。
PR-FILE-29 — `docs/` 下有 Penpot 自架說明，列出所用 Penpot 版本、啟動步驟與 MCP 外掛安裝方式；repo 內沒有含密鑰的設定檔。
PR-FILE-30 — `docs/consumer-guide.md` 與 `docs/adoption-prompt.md` 的設計稿起點指向 Penpot 版元件庫設計檔。
PR-FILE-32 — 腳本由元件庫設計檔的 `.penpot` 產生正規化文字 dump（排序固定、不含時間戳與隨機 id 等易變欄位）並提交進 repo；同一份匯出檔連續產生兩次的 dump 位元組相同；dump 與 `.penpot` 不一致時檢查回報非零結束碼並列出差異。
PR-FILE-33 — `elevation-enabled` 在 Penpot 以 shadow token 表示：開為原陰影值，關為零偏移、零模糊、透明度 0 的陰影；建置輸出的 token JSON 含此 token，離線測試比對其值與 DTCG 來源。

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
- [前端 §5.4 共用風格角色](../05_frontend_spec.md#54-共用風格角色能力設計系統)，包含 §5.4.1 資訊密度、§5.4.2 元件外形；對應 `PR-STYLE-01` 至 `PR-STYLE-07`、`PR-STYLE-09` 至 `PR-STYLE-11`。
- [前端 §5.5 共用元件庫元件](../05_frontend_spec.md#55-共用元件庫元件能力設計系統)，包含 §5.5.1 母版元件、§5.5.2 元件變數、§5.5.3 間距與動態、§5.5.4 畫面核對；對應 `PR-STYLE-09`、`PR-STYLE-11`、`PR-STYLE-12`、`PR-STYLE-14`。
