# 設計系統交付驗證

## 驗證範圍與重現

執行環境為 Node.js 22.12 以上、npm 11（CI 用 Node.js 22）、npm workspaces、Playwright Chromium。驗證時 4173（showcase）、4174（repo 外 consumer）及 4178（狀態總覽頁的開發伺服器）要保留給驗證使用，不同程序不共用服務。

```sh
npm ci
npm run build
npm run typecheck
npm run lint
npm test
npm run test:consumer
```

`test:consumer` 涵蓋 repo 外安裝、公開輸出、typecheck、production build、主題／模式／強調色／狀態、字體與授權。字體自託管與 OFL 隨建置交付，Noto Sans TC 原始字體約 11.94 MB；目前沒有子集化，不宣稱初次載入已最佳化。

## 凍結承諾與證據

承諾全文、範圍、排除項目及決策已遷移至[設計系統需求承諾](capabilities/design-system.md#需求承諾)，本表涵蓋 PR-STYLE-01～24；0.2.0 新增的 PR-STYLE-25～47、PR-FILE-16～19 見該文件，證據在各自的測試檔（以承諾 ID 標註）與下方各節。下列證據使用真實套件與瀏覽器，不以靜態設計稿 frame 代替 React 驗收。

| 承諾 | 交付成果與可重現證據 |
| --- | --- |
| PR-STYLE-01 | ThemeProvider 的專案 suite；consumer 範例與 consumer-guide 的局部密度覆寫說明；theme.spec 的四組套系模式斷言。 |
| PR-STYLE-02 | tokens.json 的 Vibrant 日夜主色／點綴；foundations.spec 四組色票與 theme.spec 正式按鈕 computed 色彩；consumer 封裝資料驗證。 |
| PR-STYLE-03 | 同上，Professional 石墨紫雙模式；公開 JSON 與 CSS 由同一來源生成。 |
| PR-STYLE-04 | tokens.json 雙模式背景、表面、文字、邊界；foundations 樣張、theme.spec 與 consumer 正式輸出。 |
| PR-STYLE-05 | theme.spec 專案強調色覆寫且三項操作狀態色不變；consumer 同樣操作公開 API。 |
| PR-STYLE-06 | foundations.spec 責任邊界說明；components.spec 帶文字結果；product.spec 業務數值色與成功提示色分離，產品圖例帶符號。 |
| PR-STYLE-07 | theme.spec 模擬裝置暗轉亮、手動暗模式、另一新頁保留偏好、回到跟隨系統；實際 localStorage 與 matchMedia。 |
| PR-STYLE-08 | foundations.spec 三種字體載入、字級／行高／字重與三份 OFL HTTP 200；consumer 以公開路徑取得字體與授權。 |
| PR-STYLE-09 | foundations.spec 兩套間距／內距、7 個斷點鄰接寬度及正文 16px；product/components/editorial 的 3 寬度與無整頁橫溢。 |
| PR-STYLE-10 | theme.spec 按鈕 16/3px 與卡片左邊界 1/3px；foundations.spec 容器 20/3px、24/20px 內距；元件 CSS 與前端 §5.5.2。 |
| PR-STYLE-11 | theme.spec 模擬 reduced-motion，按鈕 transition 從 120ms 變 0；前端 §5.5.3；React CSS 減少非必要動態。 |
| PR-STYLE-12 | 公開 Button／TextField／Select／Checkbox／Navigation／MetricCard／DataTable／StatusMessage／ContentState；components.spec 真正鍵盤 Tab、方向鍵、Space、Enter 提交及結果、失敗重試；全矩陣見下。 |
| PR-STYLE-13 | product.spec 與 editorial.spec，產品／介紹頁在雙套系、日夜及桌面／平板／手機；表格、表單、CTA、空白與錯誤還原。 |
| PR-STYLE-14 | 正式 tokens/react 套件、showcase 五頁、元件庫設計檔（`docs/mockup/luca-style-library.penpot`，ADR 0007）、consumer-guide、examples/consumer；test:consumer 從 tarball 於 repo 外安裝、typecheck、build、瀏覽器操作。 |
| PR-STYLE-15 | 本機：pages.spec 對 `build:pages` 輸出的模擬 Pages 伺服器，subpath.spec 於 `/luca-style/` 經導覽到達五個路由。線上：以手動 `curl` 確認，步驟見「公開樣張與 README」一節。 |
| PR-STYLE-16 | pages.spec：每個路由各有 `index.html`、直接開啟與重新整理回應 200；trailing-slash.spec：尾斜線與無尾斜線同一路由；模擬伺服器重現 Pages 對無尾斜線目錄的 301。 |
| PR-STYLE-17 | pages.spec 未知網址回 404；not-found.spec 與 subpath.spec：找不到頁面內容、四態、返回入口、三寬度無橫溢。 |
| PR-STYLE-18 | subpath.spec：品牌連結與頁內連結皆在 `/luca-style/` 內；`/` 下既有案例不變。route-table 單一來源與 main.tsx 由 pages-routes.spec 比對。 |
| PR-STYLE-19 | deploy-workflow.spec：push 到 main 與 PR 觸發、只有 push 才部署、deploy 依賴 verify、build→typecheck→lint→test 順序、無 continue-on-error、action 固定 SHA、權限最小。實跑紀錄見 GitHub Actions 的 `pages.yml`：PR 時 deploy 依條件跳過，push 到 main 時執行 deploy。 |
| PR-STYLE-20 | components.spec：預設品牌連結為 `/`，傳入 `brandHref` 後跟隨；consumer-guide 說明，examples/consumer 以 `brandHref="/luca-style/"` 經 test:consumer 驗證。 |
| PR-STYLE-21 | readme.spec：H2 順序、英文與一句話介紹、線上樣張連結、無「正式預覽」、有「本機預覽」、授權段落。 |
| PR-STYLE-22 | readme.spec：clone／`npm ci`／`npm run dev`、連到使用端接入文件、程式碼片段 ≤10 行且逐字來自 examples/consumer、相對連結皆存在且被 git 追蹤。 |
| PR-STYLE-23 | `npm run screenshots` 產生 `docs/images/` 四張；`npm run verify:screenshots` 驗證穩定；readme.spec 檢查 README 引用四張且檔案存在。不屬於 `npm test`。 |
| PR-STYLE-24 | 前端 §5.2 路由表下方註明路徑相對於 base path；架構 §3.1 的 Pages 部署由 deploy-workflow.spec 檢查包含必要用語。 |

## 五頁矩陣與操作

| 頁面 | 套系 × 模式 × 寬度 × 四態 | 案例 |
| --- | --- | --- |
| Home | 2 × 2 × 3 × 4 = 48 | editorial.spec |
| Foundations | 48 | delivery.spec；字級另測 390/599/600/834/1023/1024/1280 |
| Components | 48 | delivery.spec；互動適用狀態另由 components.spec |
| Product | 48 | delivery.spec；資料／表單另由 product.spec |
| Intro | 48 | editorial.spec |

寬度為 1280／834／390px；總計 240 組頁面狀態。四態迴圈斷言導覽、上下文、對應狀態訊息與整頁不橫溢；錯誤重試後還原正常內容。既有 editorial 截圖與 product 桌面／手機截圖沿用 Playwright test-results 產物，不新增重複截圖。測試產物不提交，重跑命令即可取得；不聲稱逐張像素相等。

主要導覽由 entry.spec／editorial.spec／product.spec 點擊實測；介紹頁主要行動將焦點移至價值標題。components.spec 以實際鍵盤完成表單，確認錯誤關聯與第一錯誤欄位焦點；DataTable 是帶 caption／columnheader 的原生表格，水平捲動區可聚焦。模式即時變更、記憶與減少動態由 theme.spec 實跑。

## 設計稿與程式對照

以[前端 §5.1–5.5.4](05_frontend_spec.md)及[公開對應表](consumer-guide.md#penpot-設計稿與程式同步)核對同名色彩／字體角色、23 個母版對應的正式元件、產品與介紹頁代表結構。元件庫設計檔不畫頁面（ADR 0007），頁面範本以樣張網站為準；母版的名稱、數量與變數綁定由 `npm run check:penpot` 核對。

實作保留設計角色與內容層次，以下差異由可操作網頁需要而來：

- 設計檔只放母版；React 使用單一頁面與本機「樣張狀態」選單，錯誤重試回復正常內容。
- 設計檔以狀態母版獨立展示；React 以 props、原生 disabled、hover、focus-visible 與可關聯錯誤文字實際操作。
- 網頁增加套系、模式及強調色比較控制供開發者檢視；正式使用端仍選定專案套系。Select、Checkbox 等由 Base UI 處理互動（ADR 0006），Select 選單跟著套系與明暗。
- 產品資料與圖表為本機示例，操作後可新增列；靜態範本未涵蓋所有新增資料內容。

不含三個參考專案的業務流程、後端、部署或 npm 公開發布。

## 公開樣張與 README

線上樣張 `https://luca0x5755.github.io/luca-style/` 由 push 到 `main` 的 `pages.yml` 部署。`npm test` 以本機 `build:pages` 輸出搭配模擬 GitHub Pages 的伺服器驗證，這是模擬而非真實 Pages。線上是否可開無法在 `npm test` 內機械檢查（需網路與已部署站點），要手動確認：`curl -sI https://luca0x5755.github.io/luca-style/` 應回 200，`apps/showcase/src/route-table.json` 的其餘路由加上尾斜線同樣回 200（沒有尾斜線會先回 301），不存在的網址回 404。

## 元件庫設計檔的離線檢查

元件庫設計檔 `docs/mockup/luca-style-library.penpot` 由人在 Penpot 內手動匯出（外掛的 `File.export` 會失敗）。匯出檔視為不受信任資料：只在記憶體內解開（`read-zip.mjs`），不解到磁碟。Penpot 版本與自架步驟見[自架說明](penpot-self-hosting.md)。

### 檢查指令

```sh
npm run check:penpot    # = node scripts/design/check-penpot.mjs && node scripts/design/penpot-dump.mjs docs/mockup/luca-style-library.penpot --check
node --test scripts/design/*.test.mjs
```

`npm test`（CI 的 verify job）內的 `tests/penpot-library.spec.ts` 以兩個獨立測試執行上面兩條指令。

`check-penpot.mjs` 檢查什麼（差異時結束碼 1，逐行列出）：

1. 檔名必須是 `luca-style-library`；頂層只能是 board。
2. 母版：名稱以 `name.replace(/\s*\/\s*/g, "/")` 正規化後，數量與集合等於 `bindings.json` 的 23 個 `frame`（缺、多、重複都列出）。
3. 綁定：每個母版依 `path` 走節點（子節點索引取 Penpot `shapes` 的反向序），比對節點型別、節點數與 `appliedTokens` 短鍵（`fill`、`strokeColor`、`strokeWidth`、`fontFamily`、`r1`～`r4`、`p1`～`p4`、`shadow`、`opacity`）；`bindings.json` 沒列的節點必須沒有任何綁定。
4. 解析值：12 組 Suite x Mode x Device，依 `tokenSetOrder` 與該 theme 啟用的 set 疊加（後者覆蓋前者）在匯出檔內解析，逐筆比對 `variables.json` 的 72 個變數（除下列已接受差異）；同樣的解析再套在 `penpot-tokens.json`，匯出檔與它逐 token 比對（含 `metric-shadow`），以分辨是 Penpot 檔漂移還是產生器漂移。

已接受的表示差異（程式內 `ACCEPTED`，限定母版與路徑，範圍外的同類差異照樣回報）：

- `C/State/Loading` 路徑 `0`：`fill[i].opacity` 以 4 個命名為 token 名去掉 `-opacity` 的疊放矩形（各綁一個 `opacity`）表示，節點數 8（`nodeCount` 4 加 4）。順序、型別 `rect`、名稱、token 逐一檢查。
- `C/Card/Metric` 路徑 `-`：`strokeWidth.left`（`metric-border-left`）在 Penpot 不綁；若被綁上 `strokeWidth` 則回報為多出的綁定。
- `C/Card/Metric` 路徑 `-`：`effect.enabled`（`elevation-enabled`）改綁 `shadow`＝`metric-shadow`；變數端以 `metric-shadow` 的色彩 alpha 是否為 0 對應布林（PR-FILE-33，見下）。
- `suite-label`（一般字串）沒有 Penpot token。

### 離線可讀與不可讀

| 項目 | 離線可讀 | 說明 |
| --- | --- | --- |
| 母版名稱與數量 | 是 | 頁面根 frame 的 `shapes` 中 `type: frame` 的直接子節點。巢狀的 `Loading image` 板不算；母版是板，不是元件。 |
| token set 與 theme | 是 | 群組、名稱、各自啟用的 set。與來源 JSON 字面上不同的只有寫法：匯出檔多 `$description: ""`、`fontFamilies` 值包成陣列、值為 0 的不透明度 token 由 `0%` 變成 `0`；數值相同。 |
| 每個形狀的 token 綁定 | 是 | 讀 `appliedTokens`，鍵是儲存用的短鍵，與外掛 API 的屬性名不同：字型綁定為 `fontFamily`（不是 `fontFamilies`）、`fontSize`；填色 `fill`、描邊 `strokeColor`、`strokeWidth`、`opacity`；圓角 `r1`～`r4`（API 為 `borderRadiusTopLeft` 等）；內距 `p1`～`p4`（API 為 `paddingTop` 等）。 |
| 解析後的值 | 部分 | 形狀上存的是匯出當下啟用的 theme 的解析值（記在 `$metadata.activeThemes`），其他 theme 的值不在形狀上，必須由 `tokens.json` 的 set 重新解析；所以檢查的是「綁定正確」乘上「各 theme 的 token 值正確」，不是母版在各 theme 下實際顯示的顏色。不解析別名（遇到回報「無法離線解析」）。 |
| 母版是否為元件 | 未驗證 | 現有母版都是 board，匯出檔沒有元件資料；`parse-export.mjs` 以 `componentId`／`mainInstance` 欄位名判斷是猜的，沒有真實元件可驗。母版若轉成元件，要在有元件的匯出檔上重驗。 |

匯出 zip 的結構：`manifest.json`（型別、版本、`generatedBy`、檔案清單）；`files/<檔案id>.json`（檔案層資料）；`files/<檔案id>/pages/<頁面id>.json` 與每個形狀一個的 `pages/<頁面id>/<形狀id>.json`（形狀以 `parentId`／`shapes` 連結，不是巢狀）；`files/<檔案id>/tokens.json`（所有 token set、`$themes`、`$metadata`）；`media/`、`objects/`、`thumbnails/`（圖片替身與縮圖）。

### 能否提交進 repo

匯出的 zip 是二進位，審查時看不出差異；而且匯出檔的位元組不可決定：zip 條目有匯出時間戳、縮圖的 `hash`／`id` 是隨機 uuid、`tokens.json` 的 set 與 theme 內部鍵序是雜湊序、theme id 在匯入來源 JSON 後被重新產生、檔案層有 `revn` 與 `modifiedAt`。因此 repo 同時提交兩份：

- `docs/mockup/luca-style-library.penpot`（`.gitattributes` 標為 `binary`）。
- `docs/mockup/luca-style-library.dump.json`：`penpot-dump.mjs` 產生的正規化文字 dump，是審查與驗證的形式（PR-FILE-32）。

```sh
node scripts/design/penpot-dump.mjs <匯出檔.penpot> [--out <dump>]          # 產生，預設寫在匯出檔旁（.dump.json）
node scripts/design/penpot-dump.mjs <匯出檔.penpot> --check [--out <dump>]  # 比對已提交的 dump，不一致結束碼 1 並以 - / + 列出差異行
```

dump 是 JSON（鍵遞迴排序、2 格縮排、每欄位一行）。不輸出：所有 id（形狀、頁面、檔案、媒體、theme、`shadow` 項目）、`revn`、`vern`、`modifiedAt`、`createdAt`、`hash`、`teamId`、`migrations`、`generatedBy`、`features`、縮圖與 `objects/`、可由位置與大小推得的 `selrect`、`points`、`transform`。順序有意義的清單保留來源順序：頁面根與各形狀的 `shapes`、`tokenSetOrder`。同一份匯出檔連續產生，位元組相同。

守門測試 `penpot-dump.test.mjs` 以 `exportViolations`（`penpot-test-helpers.mjs`）拒絕任何被追蹤的 `.penpot` 與以 zip 魔術位元組開頭的檔，唯一放行 `docs/mockup/luca-style-library.penpot`；放行檔名換目錄或大小寫、偽裝成別的副檔名的 zip 都仍違規。

## Penpot token 資料

### 陰影開關（PR-FILE-33）

Penpot 沒有布林變數，陰影開關以 shadow token 表示。建置另外輸出 `metric-shadow`：每個 `Suite x Mode/*` set 一個 `shadow` token，值取自該套系與明暗已解析的 DTCG `metric-shadow`。

| Suite x Mode | 陰影筆數 | offsetX / offsetY / blur / spread | 顏色 | 不透明度 |
| --- | --- | --- | --- | --- |
| Vibrant / Light | 1 | 0 / 4 / 16 / 0 | #000000 | 0.0314（8/255） |
| Vibrant / Dark | 1 | 0 / 4 / 16 / 0 | #000000 | 0.0314 |
| Professional / Light | 1 | 0 / 0 / 0 / 0 | #000000 | 0 |
| Professional / Dark | 1 | 0 / 0 / 0 / 0 | #000000 | 0 |

與 `variables.json` 的 `elevation-enabled`（Vibrant 開、Professional 關）一致。「關」是一筆零偏移、零模糊、透明度 0 的陰影，不是沒有陰影（已接受）。

### 使用端強調色 token JSON（PR-FILE-19）

`scripts/design/penpot-accent.mjs` 輸出 Penpot 可匯入的完整 token 檔；用法、匯入限制與匯入後檢查見[使用端接入](consumer-guide.md#複製元件庫設計檔並匯入專案強調色)。測試：`node --test scripts/design/penpot-accent.test.mjs`。

### Device theme

`Device` theme 只影響 `fs-hero`、`fs-title` 等有綁定的字級 token。母版文字只綁 `fill` 與 `fontFamily`，沒有任何 `fontSize` 綁到 `fs-*`，所以啟用 `Device` 後切換三個尺寸，母版畫面不會變；這不是漏綁（`packages/react/src/styles.css` 的 `.luca-metric strong` 也是固定 2rem）。此限制已寫入使用端指南。

## 尚未驗證

- 23 個母版在四種 Suite x Mode 與三種 Device 下的全面人眼核對尚未做；目前只有少量樣本以 `export_shape` 目視（`C/Field/Error`、`C/Select/Open`、`C/State/Loading`）。需要在 Penpot 內逐一看過。
- 同內容兩次匯出是否產生同一份 dump（只有一次匯出可比）。待辦：不改任何東西再匯出一次，用 `penpot-dump.mjs --check` 對照提交的 dump；若不一致，差異行會指出還有哪個欄位不穩定。
- 母版轉成元件後的匯出表示。
- 強調色 token JSON 匯入後的母版畫面。
- Penpot 的長時間編輯穩定度（沒有做壓力測試，使用者於 2026-10-30 決定不做；若遇到記憶體累積後當機，需重新評估 ADR 0008）。
