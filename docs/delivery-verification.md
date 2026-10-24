# 設計系統交付驗證

## 驗證範圍與重現

2026-10-20，ISSUE-009 第 1 輪，基底 `01e3c18`。執行環境為 Windows、Node.js 22.17.0、npm 11.4.2、npm workspaces、Playwright Chromium。先保留 4173（showcase）及 4174（repo 外 consumer）供驗證使用，不同程序不共用服務。

```sh
npm ci
npm run build
npm run typecheck
npm run lint
npm test
npm run test:consumer
```

結果：`npm ci` 成功，150 套件稽核 0 弱點；production build、typecheck、lint 全部通過；完整 Playwright **25 passed（34.5s）**，包含新增 3 個矩陣驗收案例。`test:consumer` 通過 repo 外安裝、公開輸出、typecheck、production build、主題／模式／強調色／狀態、字體與授權。第 1 輪無失敗簽章，沒有略過必要檢查。`git diff --check` 通過。字體自託管與 OFL 隨建置交付，Noto Sans TC 原始字體約 11.94 MB；目前沒有子集化，不宣稱初次載入已最佳化。

## 拆檔結構驗收

2026-10-24，ISSUE-003（PR-FILE-03、PR-FILE-04）。`scripts/design/verify-split.js` 以 `docs/mockup/components.fig` 為基準，用離線唯讀的 `openpencil eval` 比對 `components-vibrant.fig` 與 `components-professional.fig`：原檔 302 個 frame 的名稱須全部被兩檔合計涵蓋、套系 frame 不得同時出現在兩檔，並逐 frame 比對節點數（frame 加全部後代）、文字（後代 TEXT 的 characters，依樹序）與填色（frame 與全部後代的 fills）。`Library guide`、`00 / Canvas directory` 兩個共用 frame 兩檔各一份，須與原檔一致，不受「不得同時出現」限制。母版與頂層 TEXT 不在本腳本範圍。結束碼：0 全部一致、1 有差異（逐行列出 `[標籤] frame 名稱：說明`）、2 讀檔失敗。不做逐像素比對。

通過（約 12 秒）：

```sh
node scripts/design/verify-split.js; echo "exit=$?"
```

```text
頁面：Library guide
基準 frame：302
vibrant frame：152
professional frame：152
共用 frame：2
套系 frame：300
全部一致
exit=0
```

證明腳本會失敗：用 `openpencil eval 原檔 -o 副本 -c "<JS>"` 在 repo 外的暫存區（下稱 `S`）產生故意改壞的副本，再以環境變數把腳本指向副本。以下 `G` 代表
`const p=figma.root.children.find(p=>p.name==='Library guide');const f=p.children.find(c=>c.name==='Vibrant/Light/Component review');`，所有副本都由 `docs/mockup/components-vibrant.fig` 產生（除註明者）。

| 副本 | 產生用的 JS（接在 `G` 之後） | 結果 |
| --- | --- | --- |
| broken-missing | `f.remove()` | exit=1，`[遺失] Vibrant/Light/Component review：兩個設計檔都沒有` |
| broken-dup | `f.name='Professional/Light/Component review'` | exit=1，`[遺失] Vibrant/Light/Component review` 與 `[重複] Professional/Light/Component review：同時出現在 vibrant 與 professional` |
| broken-fill | `f.fills=[{type:'SOLID',color:{r:1,g:0,b:0,a:1},opacity:1,visible:true,blendMode:'NORMAL'}]` | exit=1，`[填色] Vibrant/Light/Component review：vibrant 的填色與基準不同` |
| broken-childfill | `const t=f.findAll(x=>x.type==='TEXT')[0];t.fills=[{type:'SOLID',color:{r:1,g:0,b:0,a:1},opacity:1,visible:true,blendMode:'NORMAL'}]` | exit=1，同樣是 `[填色]`（子節點填色也會被抓到） |
| broken-nodes | `f.children[f.children.length-1].remove()` | exit=1，`[節點數] …：vibrant 為 81，基準為 96`（連帶文字與填色也不同） |
| broken-text | `const k=f.findAll(x=>x.type==='TEXT')[0];k.characters=k.characters+'X'` | exit=1，只有 `[文字]` |
| broken-multi | `const g=p.children.find(c=>c.name==='Vibrant/Dark/Component review');g.fills=[<同 broken-fill 的紅色>];f.remove()` | exit=1，兩個 frame 各一行並列，共 2 項差異 |
| broken-shared | 由 professional 產生，移除 `00 / Canvas directory` | exit=1，`[共用缺失] 00 / Canvas directory：professional 沒有這個共用 frame` |
| broken-extra | `figma.createFrame()` 命名 `Vibrant/Extra` 後 `appendChild` 到頁面 | exit=1，`[多餘] Vibrant/Extra` |
| broken-source | 由基準 `components.fig` 產生，移除 `Vibrant/Light/Component review` | exit=1，`[基準] 預期 302 個 frame，實得 301` 與 `[多餘] …`，證明以基準檔為準 |
| 路徑不存在 | — | exit=2，`[讀取] vibrant：Command failed: openpencil eval "…S
ope.fig" --stdin` |

產生副本的完整指令形式（`S` 為暫存區目錄；`<G>` 與 `<JS>` 依上表代入）：

```sh
cd docs/mockup
openpencil eval components-vibrant.fig -o S/broken-fill.fig -c "<G> <JS>"
```

`broken-extra` 的 JS 為 `const p=figma.root.children.find(p=>p.name==='Library guide');const x=figma.createFrame();x.name='Vibrant/Extra';p.appendChild(x)`；`broken-shared` 的 JS 為 `const p=figma.root.children.find(p=>p.name==='Library guide');p.children.find(c=>c.name==='00 / Canvas directory').remove()`（由 professional 產生）；`broken-source` 的 JS 為 `const p=figma.root.children.find(p=>p.name==='Library guide');p.children.find(c=>c.name==='Vibrant/Light/Component review').remove()`（由 `components.fig` 產生，以 `VERIFY_SPLIT_SOURCE` 指定）。

文字與填色以 32 位元雜湊加長度比對，用途是抓誤改，不防蓄意碰撞；輸出只指到 frame 層級，不指到節點。腳本也會偵測同一設計檔內的同名 frame（`[重複] …：vibrant 內有同名 frame`），此情境未造壞副本實測。

重現其中四例（完整輸出）：

```sh
VERIFY_SPLIT_VIBRANT=S/broken-missing.fig node scripts/design/verify-split.js; echo "exit=$?"
```

```text
頁面：Library guide
基準 frame：302
vibrant frame：151
professional frame：152
共用 frame：2
套系 frame：300
[遺失] Vibrant/Light/Component review：兩個設計檔都沒有
共 1 項差異
exit=1
```

```sh
VERIFY_SPLIT_VIBRANT=S/broken-fill.fig node scripts/design/verify-split.js; echo "exit=$?"
```

```text
頁面：Library guide
基準 frame：302
vibrant frame：152
professional frame：152
共用 frame：2
套系 frame：300
[填色] Vibrant/Light/Component review：vibrant 的填色與基準不同
共 1 項差異
exit=1
```

```sh
VERIFY_SPLIT_VIBRANT=S/broken-nodes.fig node scripts/design/verify-split.js; echo "exit=$?"
```

```text
頁面：Library guide
基準 frame：302
vibrant frame：152
professional frame：152
共用 frame：2
套系 frame：300
[節點數] Vibrant/Light/Component review：vibrant 為 81，基準為 96
[文字] Vibrant/Light/Component review：vibrant 的文字內容與基準不同
[填色] Vibrant/Light/Component review：vibrant 的填色與基準不同
共 3 項差異
exit=1
```

```sh
VERIFY_SPLIT_VIBRANT=S/broken-text.fig node scripts/design/verify-split.js; echo "exit=$?"
```

```text
頁面：Library guide
基準 frame：302
vibrant frame：152
professional frame：152
共用 frame：2
套系 frame：300
[文字] Vibrant/Light/Component review：vibrant 的文字內容與基準不同
共 1 項差異
exit=1
```

腳本唯讀（以 `sha1sum docs/mockup/*.fig > before.sha` 取前後值，再 `sha1sum docs/mockup/*.fig | diff - before.sha`，無差異）：執行全部矩陣前後，`sha1sum docs/mockup/*.fig` 與 `git status --porcelain docs/mockup` 完全相同。已知限制：基準檔若被誤改而 frame 數仍為 302，腳本抓不到；`components.fig` 已進版控且在 ISSUE-006 前不變動。人眼抽查與母版比對不屬於本節（見 ISSUE-004、005）。

## 母版一致性比對

2026-10-24，ISSUE-004（PR-FILE-05、PR-FILE-06 的指令部分）。兩個套系設計檔各帶一份 22 個母版與共用物件，`scripts/design/check-masters.js` 以離線唯讀的 `openpencil eval` 讀兩檔，逐節點比對。比對單元共 26 個（vibrant 側 110 個節點）：22 個 `C/...` 母版（名單寫死於腳本）、共用 frame `Library guide` 與 `00 / Canvas directory`、2 個頂層 TEXT（兩個 `… / Style zone heading`）。單元以名稱配對，單元內依樹序以子節點索引路徑配對節點。

「相同」比對每個節點的 65 項屬性：型別、名稱、可見度、不透明度、混合模式、填色、描邊（粗細、對齊、虛線、四邊粗細）、效果、圓角（含四角與平滑度）、clipsContent、旋轉、寬高、約束、auto-layout 全部屬性（方向、對齊、間距、四邊 padding、換行、sizing mode、layoutGrow／Align／Positioning、min/max）、文字（characters、字型、字級、字重、對齊、字距、行高、大小寫、裝飾、自動縮放，另含混合樣式的分段內容）、樣式 id、元件屬性定義，並比子節點數量。`x`、`y`：頂層單元不比（兩檔頁面版面不同），所有後代的 `x`、`y`（相對父節點）要比。不比節點 id 與絕對座標，不做逐像素比對。屬性清單見腳本檔頭與 `PROPS`。

結束碼：0 全部相同、1 有差異（逐行 `[差異] 單元名稱：節點（名稱）的 屬性 不同`，另有 `[母版名單]`、`[共用缺失]`、`[重複]` 標籤，最後一行彙總差異數與涉及的單元名稱）、2 讀檔失敗。

通過（約 11 秒）：

```sh
node scripts/design/check-masters.js; echo "exit=$?"
```

```text
頁面：Library guide
母版：vibrant 22、professional 22（預期 22）
共用 frame：2；頂層 TEXT：2
比對單元：26，vibrant 節點：110，每節點屬性：65
全部相同
exit=0
```

證明腳本會失敗：用 `openpencil eval components-vibrant.fig -o S/<副本>.fig -c "<JS>"` 在 repo 外的暫存區 `S` 產生壞副本，以 `CHECK_MASTERS_VIBRANT`／`CHECK_MASTERS_PROFESSIONAL` 指向。以下 `G` 為 `const p=figma.root.children.find(p=>p.name==='Library guide');`，`RED` 為 `[{type:'SOLID',color:{r:1,g:0,b:0,a:1},opacity:1,visible:true,blendMode:'NORMAL'}]`。

| 副本 | 產生用的 JS（接在 `G` 之後） | 結果 |
| --- | --- | --- |
| b-fill | `p.children.find(c=>c.name==='C/Button/Primary').fills=RED` | exit=1，`[差異] C/Button/Primary：本身…的 fills 不同` |
| b-radius | `const m=p.children.find(c=>c.name==='C/Checkbox');m.findAll(x=>x.cornerRadius===3)[0].cornerRadius=9` | exit=1，`C/Checkbox：節點 /0（Checked box）的 cornerRadius` 與四個角半徑 |
| b-spacing | 對 `C/Button/Primary` 的 `itemSpacing` 加 5 | exit=1，`itemSpacing 不同` |
| b-remove | `p.children.find(c=>c.name==='C/Button/Primary').remove()` | exit=1，`[母版名單] C/Button/Primary：vibrant 沒有這個單元` |
| b-shared | `p.children.find(c=>c.name==='00 / Canvas directory').fills=RED` | exit=1，`[差異] 00 / Canvas directory：本身…的 fills 不同` |
| b-child | `const m=p.children.find(c=>c.name==='00 / Canvas directory');m.children[m.children.length-1].remove()` | exit=1，`childCount 不同` 與 `節點 /9 只在 professional 有` |
| b-text2 | `const t=p.children.find(c=>c.name==='Vibrant / Style zone heading');t.characters=t.characters+'X'` | exit=1，`characters`、`segments`、`height` 不同 |
| b-move | `const m=p.children.find(c=>c.name==='C/Button/Primary');m.x+=1000;m.y+=1000` | exit=0（頂層位置不比，預期相同） |
| 兩檔各壞一處 | b-radius 當 vibrant、b-fill 當 professional | exit=1，共 6 項差異，涉及 `C/Button/Primary`、`C/Checkbox` 兩個單元 |
| 路徑不存在 | — | exit=2，`[讀取] vibrant：Command failed: openpencil eval "…nope.fig" --stdin` |

重現其中一例（完整輸出）：

```sh
CHECK_MASTERS_VIBRANT=S/b-radius.fig node scripts/design/check-masters.js; echo "exit=$?"
```

```text
頁面：Library guide
母版：vibrant 22、professional 22（預期 22）
共用 frame：2；頂層 TEXT：2
比對單元：26，vibrant 節點：110，每節點屬性：65
[差異] C/Checkbox：節點 /0（Checked box）的 cornerRadius 不同
[差異] C/Checkbox：節點 /0（Checked box）的 topLeftRadius 不同
[差異] C/Checkbox：節點 /0（Checked box）的 topRightRadius 不同
[差異] C/Checkbox：節點 /0（Checked box）的 bottomLeftRadius 不同
[差異] C/Checkbox：節點 /0（Checked box）的 bottomRightRadius 不同
共 5 項差異，涉及 1 個單元：C/Checkbox
exit=1
```

唯讀：腳本執行前後 `sha1sum docs/mockup/*.fig` 相同，`git status --porcelain docs/mockup` 無變動。

已知限制：（1）`openpencil eval -o` 在目前版本無法輸出「修改了母版內文字節點」的副本（匯出時回報 `Missing bound variable`，改名、字級、新增文字皆同），所以母版內文字節點的差異沒有實際造出壞副本；文字比對的邏輯由頂層 TEXT 的 `b-text2`（`characters`／`segments`）實測，母版後代與頂層 TEXT 走同一段比對程式。（2）自動排版內子節點的 `x`、`y` 會被重新計算，無法用壞副本單獨驗證後代位置差異。（3）若兩檔同步改成另一組一致的內容，腳本不會報錯，它只保證兩檔彼此相同；母版名單另以寫死的 22 個名稱防止同步改名。（4）不做逐像素比對，視覺 QA 仍是人工。

## 凍結承諾與證據

承諾全文、範圍、排除項目及決策已遷移至[設計系統需求承諾](capabilities/design-system.md#需求承諾)，共 PR-STYLE-01～24，無 retired 行。下列證據使用真實套件與瀏覽器，不以靜態設計稿 frame 代替 React 驗收。

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
| PR-STYLE-14 | 正式 tokens/react 套件、showcase 五頁、兩個套系設計檔（components-vibrant.fig、components-professional.fig）、consumer-guide、examples/consumer；test:consumer 從 tarball 於 repo 外安裝、typecheck、build、瀏覽器操作。 |
| PR-STYLE-15 | 本機：pages.spec 對 `build:pages` 輸出的模擬 Pages 伺服器，subpath.spec 於 `/luca-style/` 經導覽到達五個路由。**線上尚未驗證**：需 push 到 `main` 並將 Pages 來源設為 GitHub Actions，詳見下節。 |
| PR-STYLE-16 | pages.spec：每個路由各有 `index.html`、直接開啟與重新整理回應 200；trailing-slash.spec：尾斜線與無尾斜線同一路由；模擬伺服器重現 Pages 對無尾斜線目錄的 301。 |
| PR-STYLE-17 | pages.spec 未知網址回 404；not-found.spec 與 subpath.spec：找不到頁面內容、四態、返回入口、三寬度無橫溢。 |
| PR-STYLE-18 | subpath.spec：品牌連結與頁內連結皆在 `/luca-style/` 內；`/` 下既有案例不變。route-table 單一來源與 main.tsx 由 pages-routes.spec 比對。 |
| PR-STYLE-19 | deploy-workflow.spec：僅 push 到 main、deploy 依賴 verify、build→typecheck→lint→test 順序、無 continue-on-error、action 固定 SHA、權限最小。工作流程尚未在 GitHub 上實跑。 |
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

主要導覽由 entry.spec／editorial.spec／product.spec 點擊實測；介紹頁主要行動將焦點移至價值標題。components.spec 以實際鍵盤完成表單，確認錯誤關聯與第一錯誤欄位焦點；DataTable 是帶 caption／columnheader 的原生表格，水平捲動區可聚焦。模式即時變更、記憶與減少動態由 theme.spec 實跑，沒有跳過這些案例。

## 設計稿與程式對照

以[前端 §5.1–5.5.4](05_frontend_spec.md)及[公開對應表](consumer-guide.md#openpencil-與程式同步)核對同名色彩／字體角色、22 母版對應的正式元件、產品與介紹頁代表結構。先前以 Pencil（當時工具，設計稿為單一 components.pen，已由兩個套系設計檔取代，見 ADR 0003）實際 QA 已確認 22 母版、12 檢視板、240 唯一 frame；各頁三寬度與 15 個 fallback 樣本曾目視核對。雙套系分區為左側 Vibrant、右側 Professional。這些是既有設計證據，本輪沒有重新開啟 components.pen：當時 Pencil MCP 開啟的是其他專案的設計檔，未讀取 .pen 的檔案系統內容，亦未修改其他設計檔。

實作保留設計角色與內容層次，以下差異由可操作網頁需要而來：

- 當時的 Pencil 設計稿分立 240 個靜態 frame；React 使用單一頁面與本機「樣張狀態」選單，錯誤重試回復正常內容。
- 當時的 Pencil 設計稿以狀態母版獨立展示；React 以 props、原生 disabled、hover、focus-visible 與可關聯錯誤文字實際操作。
- 網頁增加套系、模式及強調色比較控制供開發者檢視；正式使用端仍選定專案套系。表單使用原生選單／核取方塊，保留瀏覽器鍵盤操作，外觀不追求每個原生 popup 與靜態圖完全相同。
- 產品資料與圖表為本機示例，操作後可新增列；靜態範本未涵蓋所有新增資料內容。

沒有新增三個參考專案的業務流程、後端、部署或 npm 公開發布。正式合併與發布另由使用者決定。

## 審查與自我核准痕跡

本票只新增 delivery.spec.ts，沒有修改或刪除既有測試。新增案例是對已交付行為的矩陣驗收，不製造人工紅燈；若發現實作 bug 才以重現紅燈先行修復。本輪沒有實作 bug，也沒有拒絕的 review finding。獨立三軸審查：Standards PASS；Spec PASS（14 項承諾原文、範圍、排除項目與授權來源遷移完整）；Reuse 無發現。審查要求將本文件的待填結果補成實跑結果，已完成。自我核准痕跡：修改／刪除既有測試 none；Rejected review finding none。協調者於整合後另執行最終驗證及規格清理。

## 公開樣張與 README

2026-10-22，ISSUE-008。`npm test` 72 passed（default、subpath、pages 三個專案，含新增 readme.spec 9 案）；`npm run build`、`typecheck`、`lint`、`test:consumer` 全部通過。README 引用的四張截圖已目視確認為正確的入口頁（精緻活力與精緻專業各日間、暗黑）。

**尚未線上驗證（需使用者操作）**：`https://luca0x5755.github.io/luca-style/` 在本輪檢查時回應 HTTP 404，repo 的 Pages 尚未啟用，`pages.yml` 也尚未在 GitHub 上實跑。PR-STYLE-15 的線上部分與 PR-STYLE-19 的線上行為，須在使用者將本分支合併並 push 到 `main`、把 Settings → Pages 的來源設為「GitHub Actions」後，以 `curl -sI https://luca0x5755.github.io/luca-style/` 確認 200，再檢查五個路由與一個不存在網址的 404。在此之前不宣稱線上樣張已可開啟。其餘承諾皆以本機 `build:pages` 輸出搭配模擬 GitHub Pages 的伺服器驗證，這是模擬而非真實 Pages。

README 的線上樣張連結是否有效，無法在 `npm test` 內機械檢查（需網路與已部署站點），因此列為上述手動驗證。

## 強調色覆寫回歸修正（2026-10-20）

使用者發現 Vibrant 暗黑產品範本的本月累計卡片在覆寫後使用淺底配亮字。原覆寫只有日間色票；新增 ThemeProvider 明暗成對 accent 輸入，showcase 隨實際模式選色，保留單一色票 API。日間柔和底同步調亮，避免次要文字低於 4.5:1。新增 theme.spec 回歸測試，逐一檢查雙套系雙模式的卡片標籤、標題、數值與說明之 computed 色彩對比。舊建置重現暗黑 1.80:1；修正後四組均達 4.5:1。build、typecheck、lint 通過，theme.spec 4 passed，暗黑截圖已目視檢查。這是色彩回歸驗證，未新增 mockup 像素差異比對。


## 主題資料擷取（ISSUE-007）

2026-10-24，基底 `607c1a7`。`.pen` 的變數在轉成 `.fig` 時被攤平成預設主題（Vibrant／Light）的固定顏色；`.pen` 刪除前（ISSUE-006）把它唯一保有的主題資料存成 JSON，供 ISSUE-008／009 建立變數與綁定、ISSUE-010 比對。

輸出（皆在 `docs/mockup/themes/`）：

- `variables.json`：48 個變數的型別、原始定義，以及在 12 個主題組合（mode × suite × device，鍵為 `Light/Vibrant/Desktop` 這種格式）下的值。
- `bindings.json`：每個頁面 frame 的每個被綁定屬性：frame 名稱、節點索引路徑、節點類型、屬性、變數名稱；母版另存在 `masters`。
- `resolved.json`：每個頁面 frame 在自己的主題下，每個被綁定屬性解析後的實際值；母版以預設主題（Vibrant／Light／Desktop）解析。opacity 類變數保留原值 0–100，不做 Pencil 內部的 0–1 正規化。
- `extract-raw.txt`、`variables-raw.txt`：從 Pencil 抽出的原始文字，是上面三份 JSON 的唯一輸入。

### 檔案大小與筆數

「筆數」：variables.json 為變數數；bindings.json 與 resolved.json 為展開後的綁定總數（頁面 frame 20,846＋母版 212）。三份都遠低於 5 MB，所以維持單檔，不分套系。

| 檔案 | bytes | 筆數 |
| --- | --- | --- |
| variables.json | 34718 | 48 |
| bindings.json | 906116 | 21058 |
| resolved.json | 765053 | 21058 |

涵蓋範圍：304 個頂層項目（302 個頁面 frame 加兩個頂層標題文字）與 22 個母版；展開後共 11,444 個頁面節點、94 個母版節點。未展開時 `.pen` 內的 `$` 引用為頁面 7,930 筆、母版 207 筆（工單寫的「約 7,500」是估計；母版內的引用在每個實例裡會再展開一次，所以展開後的筆數較多）。逐類型筆數：fill（frame 2,091、text 6,122、icon 839、rectangle 624）、stroke 1,883、strokeWidth 451、fontFamily 6,122、fontSize 508、gap 288、padding 170、cornerRadius 1,434、effect.enabled 85、strokeWidth.left 85、fill 的四個 opacity 各 89；完整表見腳本 `--check` 的獨立計數。

### 重做步驟

1. 開啟 Pencil 並載入 `docs/mockup/components.pen`（加密檔，只能經由 pencil MCP 的 `execute` 存取，不可修改）。
2. 依 `scripts/design/extract-pen-themes.pen.js` 的片段 1 印出變數，存成 `docs/mockup/themes/variables-raw.txt`。
3. 依片段 2 印出綁定（Pencil 不能寫檔，輸出經對話複製成文字檔；太長就調大 `START` 分批，前 `START` 個 frame 只重放不輸出，編號才會一致），存成 `extract-raw.txt` 的主體。末行應為 `BAD total 0 … frames 304 masters 22`；0 代表離線推導的值與 Pencil `resolveVariables` 的結果逐筆相同。
4. 依片段 3 取得四行 `#independent-count`，連同 `#pencil-resolve-check mismatches=0 frames=304 masters=22` 放在 `extract-raw.txt` 最前面。
5. 執行：

```sh
node scripts/design/build-theme-data.js              # 建置三份 JSON
node scripts/design/build-theme-data.js --check      # 內部一致性、型別、逐類型獨立計數、5 MB 上限
node scripts/design/build-theme-data.js --check-fig  # 與兩個 .fig 比對節點數、名稱序列、路徑與類型（約 8 秒）
node scripts/design/build-theme-data.js --check-doc  # 本節的大小、筆數與抽樣表
node --test scripts/design/build-theme-data.test.js                          # 腳本自己的行為測試
```

### 節點對應規則

`.pen` 的頁面節點是未展開的實例，`.fig` 是展開後的。對 `.pen` 的 frame 呼叫 `Get(id, visitor, { resolveInstances: true })` 得到的展開樹，與 `.fig` 同名 frame 的深度優先順序、節點數與節點名稱完全相同。索引路徑因此定義為：根節點記為 `-`，其下每層用子節點的 0 起算索引以 `.` 相連，兩邊共用。`--check-fig` 對全部 304 個頂層項目與 22 個母版逐一確認：節點數相等、名稱序列雜湊相等、每個綁定路徑在 `.fig` 存在且節點類型相容（文字對 TEXT、矩形對 RECTANGLE、frame 對 FRAME／INSTANCE、圖示不可是 TEXT），並反向確認 `.fig` 內每個非母版頂層節點都在抽取結果裡；共檢查 9,984 條綁定路徑，全部一致。

頁面 frame 的主題由名稱推出（名稱沒寫的軸取 Light／Vibrant／Desktop；`Mobile components` 與 `Tablet typography` 兩個頁名帶裝置）。這與 `.pen` 的實際 `theme` 屬性一致：所有實例節點的 `theme` 都等於所屬頁面 frame（0 個例外）；Library guide、兩個頂層標題文字與母版沒有 `theme`，以預設主題解析。

### Pencil 與 Pencil 之外的限制

- Pencil 解析後的輸出會省略預設值：opacity 100、`effect.enabled` 為 true、四邊相同的 strokeWidth。比對時對這三類做了明確的等價處理，其他屬性是逐值比對。
- `resolved.json` 的值由 `variables.json` 加主題推導；與 Pencil 的 `resolveVariables` 結果一致這件事，是在 Pencil 內對 304 個頁面項目與 22 個母版逐筆比對得到的（BAD total 0），該結果記在 `extract-raw.txt` 檔頭。`.pen` 刪除後這項比對無法重跑，只能用片段 2 重現當時的做法。

### 抽樣核對（5 個 Dark、5 個 Light）

每個 frame 取兩列：頁面背景（路徑 `-`）與一個帶強調色的節點。「resolved.json 值」由 `--check-doc` 與 `resolved.json` 逐列比對；「Pencil 畫面所見」是人工用 `TakeScreenshot` 目視 10 張截圖的結果，這一欄腳本無法驗證。結果：Dark 的底色皆為近黑綠、Light 為淺米白；Vibrant 的強調色在 Dark 為淺青綠、Light 為深青綠，Professional 在 Dark 為淡紫、Light 為灰紫；Vibrant 圓角明顯、Professional 圓角極小；全部與 `resolved.json` 一致。

| frame | 路徑 | 屬性 | resolved.json 值 | Pencil 畫面所見 |
| --- | --- | --- | --- | --- |
| NotFound/Vibrant/Dark/Mobile/Success | - | fill | #151A18 | 近黑綠底 |
| NotFound/Vibrant/Dark/Mobile/Success | 3.0.0 | fill | #64C2BC | 按鈕為淺青綠、圓角明顯 |
| NotFound/Professional/Dark/Desktop/Success | - | fill | #151A18 | 近黑綠底 |
| NotFound/Professional/Dark/Desktop/Success | 3.0.0 | fill | #ABA4D7 | 按鈕為淡紫、圓角極小 |
| Home/Professional/Dark/Tablet/Empty | - | fill | #151A18 | 近黑綠底 |
| Home/Professional/Dark/Tablet/Empty | 3.2.0 | fill | #ABA4D7 | 次要按鈕文字與邊框為淡紫 |
| Home/Vibrant/Dark/Mobile/Error | - | fill | #151A18 | 近黑綠底 |
| Home/Vibrant/Dark/Mobile/Error | 3.2.0 | fill | #64C2BC | 次要按鈕文字與邊框為淺青綠 |
| Intro/Professional/Dark/Mobile/Loading | - | fill | #151A18 | 近黑綠底 |
| Intro/Professional/Dark/Mobile/Loading | 3.2.0 | fill | #ABA4D7 | 返回入口按鈕邊框為淡紫 |
| NotFound/Vibrant/Light/Mobile/Success | - | fill | #F7F7F2 | 淺米白底 |
| NotFound/Vibrant/Light/Mobile/Success | 3.0.0 | fill | #147F82 | 按鈕為深青綠、圓角明顯 |
| NotFound/Professional/Light/Tablet/Success | - | fill | #F7F7F2 | 淺米白底 |
| NotFound/Professional/Light/Tablet/Success | 3.0.0 | fill | #625C83 | 按鈕為灰紫、圓角極小 |
| Home/Professional/Light/Mobile/Empty | - | fill | #F7F7F2 | 淺米白底 |
| Home/Professional/Light/Mobile/Empty | 3.2.0 | fill | #625C83 | 次要按鈕文字與邊框為灰紫 |
| Home/Vibrant/Light/Tablet/Error | - | fill | #F7F7F2 | 淺米白底 |
| Home/Vibrant/Light/Tablet/Error | 3.2.0 | fill | #147F82 | 次要按鈕文字與邊框為深青綠 |
| Intro/Vibrant/Light/Mobile/Loading | - | fill | #F7F7F2 | 淺米白底 |
| Intro/Vibrant/Light/Mobile/Loading | 3.2.0 | fill | #147F82 | 返回入口按鈕邊框為深青綠 |

## 套系設計檔的變數集合與模式（ISSUE-008）

2026-10-24。`scripts/design/apply-variables.js` 讀 `docs/mockup/themes/variables.json`，用離線 `openpencil eval` 在兩個套系設計檔建立變數集合與模式（48 個變數）。`suite` 軸不建模式，每檔只取自己套系的值。

### 建模

Figma 的模式屬於集合，一個節點在每個集合只持有一個模式，所以每條軸一個集合：

| 集合 | 模式 | 放什麼 | 變數數 |
| --- | --- | --- | --- |
| `Mode` | Light、Dark | 依明暗變化的變數（含 mode＋suite：套系固定後只剩 mode） | 19 |
| `Device` | Desktop、Tablet、Mobile | 只依裝置變化的變數（`fs-hero`、`fs-title`、`fs-section`） | 3 |
| `Base` | Default | 不隨明暗與裝置變化的常數，以及只依套系變化的變數（套系固定後是常數） | 26 |

- 分類看兩個套系合併後的變化軸，所以兩個檔案的集合結構完全相同。
- 目前沒有任何變數同時依 mode 與 device 變化；日後出現時，腳本以結束碼 1 拒絕並指出變數名稱，必須先把它拆成各依單軸的變數。
- Done when 沒寫 `Base`：不依 device 變化的變數不放 `Device`，所以需要一個地方放常數。
- opacity 類變數（`loading-*-opacity`）維持 `variables.json` 的 0–100 原值，型別 `FLOAT`，與 `resolved.json` 一致；ISSUE-009 綁定時若需要 0–1，由綁定端換算。
- 節點數 5826 = 原本 5825 加一個空白的 `Internal Only Canvas` 頁：檔案一旦含變數，存檔時 OpenPencil 會建立它來存放變數，之後再存檔不會重複產生。`verify-split.js`、`check-masters.js`、`build-theme-data.js --check-fig` 在加入變數後仍全部通過。

### 指令與結果

```sh
node scripts/design/apply-variables.js           # 套用；已是最新就不寫檔
node scripts/design/apply-variables.js --check   # 唯讀：逐變數、逐 (mode, device) 組合與 variables.json 比對，並檢查節點數 < 10,000
node scripts/design/apply-variables.js --list    # 唯讀：列出每個變數在每個模式的值
node --test scripts/design/apply-variables.test.js
```

- 首次套用：兩檔各「新增 48、更新 0、移除 0」；重跑：兩檔皆「已是最新，不寫檔」（無重複的集合或變數）。
- `--check`：兩檔「節點數 5826，變數與 variables.json 逐筆一致」。檢查邏輯獨立於分類：對 48 個變數、本套系的 3 個裝置×2 個明暗共 6 個組合，在檔內找到該變數並用模式名稱挑值，顏色以 `Math.round(x*255)` 轉回十六進位後與 JSON 比對（alpha 必須為 1），數值、字串、布林嚴格相等。
- 測試：`node --test scripts/design/apply-variables.test.js` 11 項全過（在 `.fig` 暫存副本上套用，用 `openpencil eval` 讀回）。

### MCP `set_fill` 驗證：未完成

OpenPencil App 在這次執行中，`open_file` 對 `components-vibrant.fig` 的副本、`HEAD` 版本（沒有變數）的副本與原檔都回傳逾時（或 `ResourceCache cleanup failed`），等待超過 10 分鐘仍未出現在 `list_documents`；App 本身有回應（`list_collections` 對既有的小分頁正常）。因為連沒有變數的 `HEAD` 版本也打不開，這不是變數造成的，是 App 目前載入大檔失敗，所以無法完成 MCP `set_fill` 驗證。替代證據（不等同 MCP）：離線 `openpencil eval` 把套用變數後的 vibrant 副本中葉節點 `Footer divider`（RECTANGLE）填色改為紅色並另存，重新讀檔後填色已改且 48 個變數仍在。ISSUE-008 因此帶著這一項未驗就結案；ISSUE-009 的 Done when 有同一條（MCP `set_fill`），App 能載入大檔後在 ISSUE-009 或 ISSUE-010 一併補驗，兩檔都要驗。

### 重新讀檔列出的值（`--list` 輸出）

#### components-vibrant.fig（Vibrant）

| 集合 | 變數 | 型別 | 各模式的值 |
| --- | --- | --- | --- |
| Mode | bg | COLOR | Light #F7F7F2；Dark #151A18 |
| Mode | surface | COLOR | Light #FFFFFF；Dark #1D2420 |
| Mode | surface-subtle | COLOR | Light #F1F3EE；Dark #252E28 |
| Mode | text | COLOR | Light #24312A；Dark #EDF3ED |
| Mode | muted | COLOR | Light #626F65；Dark #A5B5A8 |
| Mode | border | COLOR | Light #DDE5DC；Dark #354139 |
| Mode | accent | COLOR | Light #147F82；Dark #64C2BC |
| Mode | accent-soft | COLOR | Light #E3F2F0；Dark #173637 |
| Mode | accent-ink | COLOR | Light #FFFFFF；Dark #151A18 |
| Mode | secondary | COLOR | Light #DF826D；Dark #E8A18B |
| Mode | success | COLOR | Light #237354；Dark #7ED4AB |
| Mode | warning | COLOR | Light #886018；Dark #EAC678 |
| Mode | error | COLOR | Light #B24445；Dark #F29C96 |
| Mode | card-highlight | COLOR | Light #E3F2F0；Dark #173637 |
| Mode | control-border | COLOR | Light #7B8C80；Dark #65766B |
| Mode | loading-tide-light-opacity | FLOAT | Light 100；Dark 0 |
| Mode | loading-tide-dark-opacity | FLOAT | Light 0；Dark 100 |
| Mode | loading-square-light-opacity | FLOAT | Light 0；Dark 0 |
| Mode | loading-square-dark-opacity | FLOAT | Light 0；Dark 0 |
| Device | fs-hero | FLOAT | Desktop 56；Tablet 44；Mobile 32 |
| Device | fs-title | FLOAT | Desktop 32；Tablet 28；Mobile 24 |
| Device | fs-section | FLOAT | Desktop 24；Tablet 22；Mobile 20 |
| Base | font-zh | STRING | Default Noto Sans TC |
| Base | font-en | STRING | Default Inter |
| Base | font-data | STRING | Default IBM Plex Mono |
| Base | radius-card | FLOAT | Default 20 |
| Base | radius-control | FLOAT | Default 16 |
| Base | border-width | FLOAT | Default 1 |
| Base | card-padding | FLOAT | Default 24 |
| Base | gap-section | FLOAT | Default 32 |
| Base | fs-card | FLOAT | Default 18 |
| Base | fs-body | FLOAT | Default 16 |
| Base | fs-small | FLOAT | Default 14 |
| Base | fs-label | FLOAT | Default 12 |
| Base | elevation-enabled | BOOLEAN | Default true |
| Base | metric-border-left | FLOAT | Default 1 |
| Base | suite-label | STRING | Default 精緻活力 · 潮汐 |
| Base | space-1 | FLOAT | Default 4 |
| Base | space-2 | FLOAT | Default 8 |
| Base | space-3 | FLOAT | Default 12 |
| Base | space-4 | FLOAT | Default 16 |
| Base | space-6 | FLOAT | Default 24 |
| Base | space-8 | FLOAT | Default 32 |
| Base | space-12 | FLOAT | Default 48 |
| Base | space-16 | FLOAT | Default 64 |
| Base | motion-feedback | FLOAT | Default 120 |
| Base | motion-standard | FLOAT | Default 180 |
| Base | motion-region | FLOAT | Default 240 |

#### components-professional.fig（Professional）

| 集合 | 變數 | 型別 | 各模式的值 |
| --- | --- | --- | --- |
| Mode | bg | COLOR | Light #F7F7F2；Dark #151A18 |
| Mode | surface | COLOR | Light #FFFFFF；Dark #1D2420 |
| Mode | surface-subtle | COLOR | Light #F1F3EE；Dark #252E28 |
| Mode | text | COLOR | Light #24312A；Dark #EDF3ED |
| Mode | muted | COLOR | Light #626F65；Dark #A5B5A8 |
| Mode | border | COLOR | Light #DDE5DC；Dark #354139 |
| Mode | accent | COLOR | Light #625C83；Dark #ABA4D7 |
| Mode | accent-soft | COLOR | Light #EEEDF4；Dark #2D2A3B |
| Mode | accent-ink | COLOR | Light #FFFFFF；Dark #151A18 |
| Mode | secondary | COLOR | Light #6799B9；Dark #8BBDD8 |
| Mode | success | COLOR | Light #356858；Dark #93C6B2 |
| Mode | warning | COLOR | Light #80601F；Dark #DBC28B |
| Mode | error | COLOR | Light #A34B5C；Dark #DDA3B2 |
| Mode | card-highlight | COLOR | Light #FFFFFF；Dark #1D2420 |
| Mode | control-border | COLOR | Light #7B8C80；Dark #65766B |
| Mode | loading-tide-light-opacity | FLOAT | Light 0；Dark 0 |
| Mode | loading-tide-dark-opacity | FLOAT | Light 0；Dark 0 |
| Mode | loading-square-light-opacity | FLOAT | Light 100；Dark 0 |
| Mode | loading-square-dark-opacity | FLOAT | Light 0；Dark 100 |
| Device | fs-hero | FLOAT | Desktop 56；Tablet 44；Mobile 32 |
| Device | fs-title | FLOAT | Desktop 32；Tablet 28；Mobile 24 |
| Device | fs-section | FLOAT | Desktop 24；Tablet 22；Mobile 20 |
| Base | font-zh | STRING | Default Noto Sans TC |
| Base | font-en | STRING | Default Inter |
| Base | font-data | STRING | Default IBM Plex Mono |
| Base | radius-card | FLOAT | Default 3 |
| Base | radius-control | FLOAT | Default 3 |
| Base | border-width | FLOAT | Default 1.5 |
| Base | card-padding | FLOAT | Default 20 |
| Base | gap-section | FLOAT | Default 24 |
| Base | fs-card | FLOAT | Default 18 |
| Base | fs-body | FLOAT | Default 16 |
| Base | fs-small | FLOAT | Default 14 |
| Base | fs-label | FLOAT | Default 12 |
| Base | elevation-enabled | BOOLEAN | Default false |
| Base | metric-border-left | FLOAT | Default 3 |
| Base | suite-label | STRING | Default 精緻專業 · 石墨紫 |
| Base | space-1 | FLOAT | Default 4 |
| Base | space-2 | FLOAT | Default 8 |
| Base | space-3 | FLOAT | Default 12 |
| Base | space-4 | FLOAT | Default 16 |
| Base | space-6 | FLOAT | Default 24 |
| Base | space-8 | FLOAT | Default 32 |
| Base | space-12 | FLOAT | Default 48 |
| Base | space-16 | FLOAT | Default 64 |
| Base | motion-feedback | FLOAT | Default 120 |
| Base | motion-standard | FLOAT | Default 180 |
| Base | motion-region | FLOAT | Default 240 |

## 變數綁定與 frame 模式（ISSUE-009）

2026-10-24。`scripts/design/apply-bindings.js` 依 `docs/mockup/themes/bindings.json` 把變數綁到兩個套系設計檔的節點，並依 frame 名稱設定模式。`.fig` 與 `.pen` 的節點以 frame 名稱加索引路徑對應（見上方「節點對應規則」）。

```sh
node scripts/design/apply-bindings.js           # 套用；已一致就不寫檔，可重跑
node scripts/design/apply-bindings.js --check   # 唯讀：逐筆比對綁定、儲存值、frame 模式，並檢查節點數 < 10,000
node --test scripts/design/apply-bindings.test.js
```

### 做了什麼

- 每個檔案 175 個 frame／母版（22 母版＋各自套系與共用的頁面 frame）、10,648 筆綁定，全部綁定並把儲存值覆蓋為該 frame 模式下的變數值。兩檔都是 5,826 個節點。
- 屬性對應：fill → `fills/0/color`、stroke → `strokes/0/color`、strokeWidth → `strokeWeight`、strokeWidth.left → `borderLeftWeight`、fontFamily、fontSize、cornerRadius、gap → `itemSpacing`、padding → 四個 `padding*` 欄位。實例內的子節點也逐一綁定；離線 API 不會把母版的綁定同步到實例，所以不依賴繼承。
- 頁面 frame 的 `Mode`（Light／Dark）與 `Device`（Desktop／Tablet／Mobile）依名稱設定，名稱沒寫的軸、母版與 Library guide 不設。
- 增補 `docs/mockup/themes/strokes.json`：`.fig` 轉換丟掉了全部描邊（0 個節點有 strokes），而 bindings.json 有 957 筆 stroke 綁定。腳本先補上一條 INSIDE 描邊再綁色。粗細取自 strokeWidth 綁定；只綁 `strokeWidth.left` 時其餘三邊為 1；其他不均勻粗細（只有下邊、固定 2 或 3）由 strokes.json 提供，沒列出的為 1。strokes.json 由 Pencil 在 `resolveInstances`＋`resolveVariables` 下擷取（`extract-pen-themes.pen.js` 片段 5，12 個本體、305 個 frame），無法由 `.pen` 刪除後重現。

### 無法照字面綁定、或與工單描述不同的地方

- **opacity（`fill[i].opacity`，4 個變數）**：openpencil 沒有「填色透明度」的綁定欄位，只有整個節點的 `opacity`，而且被限制在 0–1，不是 0–100，所以不綁定。變數維持 0–100 的 FLOAT，腳本把第 i 個填色的儲存 opacity 設為「變數值 ÷ 100」（Dark：1 號填色為 1，其餘 0）。這 4×45 筆是只設儲存值、沒有綁定。
- **effect.enabled**：沒有 boolean 效果的綁定欄位（只有 `visible`），同樣只設儲存值（效果 `visible`＝變數值）。43 筆。
- **strokeWidth.left**：綁定 `borderLeftWeight`。
- **懸空綁定**：`.fig` 轉換留下指向已不存在變數的 `fills[0]`、`fontFamily` 綁定（兩檔各 4,890＋3,092 筆），讓離線寫檔直接報 `Missing bound variable`。腳本在記憶體中先清掉再綁；重新讀檔確認兩檔的 boundVariables 與外掛資料中都已沒有指向不存在變數的項目（0 筆），測試也以此斷言。
- **Professional 檔裡的母版**：resolved.json 的母版與兩個共用項目（`00 / Canvas directory`）以 Vibrant／Light 預設解析；Professional 檔的這些項目取本套系的值（59 筆與 resolved.json 不同，全是這類，例如 C/Button/Primary 的填色是 #625C83）。腳本啟動時先確認「頁面 frame 與 resolved.json 逐筆相同」（21,058 筆），其餘 238 筆改用 variables.json 的本套系值。

### 對 resolved.json 的比對

獨立於腳本的一次比對（`openpencil eval` 逐一讀回每個綁定屬性的儲存值，與 resolved.json 比，兩檔各 10,648 筆）：Vibrant 10,425 筆相同、0 筆不同；Professional 10,366 筆相同、59 筆不同（即上段的母版／共用項目，值是 Professional 的、resolved.json 是 Vibrant 預設的）。其餘 223 筆（兩檔各）讀不到：`strokeWidth.left` 43 筆（讀回 API 的限制）、四個 fill opacity 共 180 筆（以第二段 openpencil 讀回確認 Dark／Light 的 `fills[i].opacity` 為 0 或 1，另有 `--check` 逐筆比對）；這 223 筆我沒有用第二套獨立程式逐筆比，是由 `--check` 比對。

### 兩張驗收圖

```sh
# frame id 先用 openpencil eval 以名稱查得：Home/Vibrant/Light/Desktop/Success = 0:158、Dark = 0:332
openpencil export docs/mockup/components-vibrant.fig --node 0:158 -o <暫存區>/home-vibrant-light-desktop-success.png
openpencil export docs/mockup/components-vibrant.fig --node 0:332 -o <暫存區>/home-vibrant-dark-desktop-success.png
```

圖放在 `test-results/` 之外（`npm test` 會清空它），不進版控。左上角像素：Dark #151A18、Light #F7F7F2；導覽列 Dark #1D2420、Light #FFFFFF；主按鈕 Dark #64C2BC、Light #147F82，與 variables.json 相同。

目視：Dark 圖的頁面底色、導覽列、卡片、按鈕與文字都是深色主題（近黑綠底、淺色字、淺青綠按鈕與邊框）；Light 圖維持淺米白底、深字、深青綠按鈕。**但兩張圖的版面都有重疊**：標題「為您的下一個專案，建立一致的起點。」變成 56px 大字，與麵包屑、說明文字及按鈕疊在一起；「繼續探索」標題壓在按鈕上，卡片內部也有疊字。原因是各 frame 的節點已改成 56／24 的字級與 24 的內距，但離線寫檔不會重算自動版面（文字高度、frame 高度與子節點位置仍是舊值）。這是版面重算問題，不是顏色問題。我試過在記憶體中重設一次字級觸發重算，圖仍有同樣疊字，檔案裡 frame 與文字的 y 與高度也未更新。重新開檔後 OpenPencil App 是否重算，我沒有驗證。ISSUE-010 驗證主題還原時請一併留意。

### MCP 驗證（重新開檔後）

兩個 `.fig` 寫完後，`close_file`（unsaved: discard）關掉過期的 tab-1、tab-2，再 `open_file` 兩檔（這次直接成功，tab-3 vibrant、tab-4 professional）。

- `node_bindings` 對 `0:332`（Home/Vibrant/Dark/Desktop/Success）：vibrant 回 `fills/0/color`＝1807162738:3、`itemSpacing`＝1807162738:36；professional 回 1799595978:3、:36（各檔自己的變數 id）。
- `set_fill` 對葉節點 `0:187`（Footer divider，RECTANGLE）設成 #FF0000：兩檔都回傳成功；隨即 `undo`（兩檔都 applied），未呼叫 `save_file`。`get_node` 讀回 vibrant 的 0:187 填色為 #DDE5DC，且仍綁定 `border`。
- 因此 ISSUE-008 留下的「MCP `set_fill` 未驗證」在此補上，兩檔都已驗證。

### 其他腳本在綁定後的結果

- `check-masters.js`：當時**不再通過**（220 項差異，全是主題屬性）；已在 ISSUE-010 改寫並重新通過，見「主題保真驗收（ISSUE-010）」。
- `verify-split.js`：當時填色部分有 302 項差異（基準是預設主題的攤平值）；已在 ISSUE-010 改成不再與基準比填色，見「主題保真驗收（ISSUE-010）」。
- `apply-variables.js --check`：兩檔通過；`build-theme-data.js --check-fig`：通過（9,984 條路徑）。

## 主題保真驗收（ISSUE-010）

2026-10-24，基底 `6e368cc`。補上先前結構驗收抓不到的缺口：基準 `components.fig` 本身已丟失主題，所以明暗模式遺失不會被發現。三支腳本分工如下，全程離線唯讀的 `openpencil eval`，不經過 OpenPencil App，不做逐像素比對。

| 腳本 | 驗什麼 | 基準 |
| --- | --- | --- |
| `scripts/design/verify-themes.js`（新） | 每個頁面 frame、母版、共用項目解析後的值：填色、描邊色、字型、字級、間距、內距、圓角（另加描邊粗細） | `docs/mockup/themes/resolved.json` |
| `scripts/design/verify-split.js`（改） | frame 名稱、節點數、文字仍與 `components.fig` 比；填色不再與它比；新增 Light 與 Dark 顏色分布不得相同 | `components.fig`（結構）、設計檔自身（明暗） |
| `scripts/design/check-masters.js`（改） | 兩檔母版與共用項目結構相同，套系專屬值由各自的變數解釋 | 兩檔互比＋`variables.json` |

```sh
node scripts/design/verify-themes.js
node scripts/design/verify-split.js
node scripts/design/check-masters.js
node --test scripts/design/verify-themes.test.js scripts/design/verify-split.test.js scripts/design/check-masters.test.js
```

三支腳本對已提交的兩個設計檔結束碼都是 0（驗證結果見各節）。

### verify-themes.js

- 取值：`figma.graph.resolve{Color,Number,String}VariableForNode(節點, 綁定的變數)`，所以用的是節點在其 frame 模式下的解析值。基準有值的屬性，檔案裡必須綁變數（綁定被移除、儲存值還在也失敗）；節點上的儲存值也必須等於基準。
- 浮點容忍：顏色每個通道與數值皆 1/255 以內。差 1/255 的測試通過，差 2/255 失敗。
- 輸出：每個檔案逐類印出比對筆數與不比對筆數；不一致時逐行 `[差異] frame 節點 路徑 屬性：期望 …，實際 …`，結束碼 1。
- 只比儲存值（沒有綁定欄位）：`effect.enabled`（效果 `visible`）與 `fill[i].opacity`（變數值 0–100，儲存值為 ÷100）。
- 不比對：`strokeWidth.left`（每檔 43 筆）。讀回 API 取不到單邊描邊粗細，這 43 筆的值沒有被任何腳本驗證，只有 `apply-bindings.js --check` 對綁定關係的檢查與 `check-masters.js` 的綁定變數名稱比對涵蓋到綁定本身。
- Professional 檔裡的母版與共用項目：`resolved.json` 的這些條目是以 Vibrant／Light／Desktop 解析的（Professional 檔有 59 筆本來就不同，是預期差異）。期望值不直接沿用，而是用 `bindings.json` 的變數名稱加 `variables.json` 的 Professional 值推導（`scripts/design/theme-expected.js`），並對 Vibrant 條目逐筆檢查「推導值＝`resolved.json`」，不同就失敗，所以推導本身沒有被隱性放寬。沒有白名單。

已提交的兩檔結果（約 9 秒）：

```text
Vibrant：175 個 frame／母版，比對 10863 筆
  填色：4890  描邊：957  字型：3092  字級：254  間距：144  內距：344  圓角：730  描邊粗細：229
  僅儲存值：fill[i].opacity：180  effect.enabled：43   不比對（strokeWidth.left）：43
  全部一致
Professional：筆數相同，全部一致
exit=0
```

實際輸出每類一行。

### 證明它會失敗

用 `openpencil eval 原檔 --stdin -o 副本` 在暫存區產生故意改壞的副本（`scripts/design/test-helpers.js` 的 `mutate`），以環境變數指向副本。以下都是 `verify-themes.test.js` 的案例，輸出取自斷言的字面值：

| 副本 | 改法 | 結果 |
| --- | --- | --- |
| Dark frame 設回 Light | `Home/Vibrant/Dark/Desktop/Success` 的 `Mode` 設為 Light | exit=1：`[差異] Home/Vibrant/Dark/Desktop/Success 節點 - fill：期望 #151A18，實際 #F7F7F2` |
| 變數值被改 | `bg` 的 Light 值 #F7F7F2 → #F7F7F4 | exit=1：`[差異] Home/Vibrant/Light/Desktop/Success 節點 - fill：期望 #F7F7F2，實際 #F7F7F4` |
| 變數值差 1/255 | `bg` 的 Light 值 → #F7F7F3 | exit=0（在容忍內） |
| 綁定被移除 | Dark frame 根節點解除 `fills/0/color` 綁定 | exit=1：`[差異] Home/Vibrant/Dark/Desktop/Success 節點 - fill：期望 #151A18，實際 未綁定變數（fills/0/color）` |
| Professional 母版值被換成 Vibrant | Professional 檔 `accent` 的 Light 值改成 #147F82 | exit=1：`[差異] C/Button/Primary 節點 - fill：期望 #625C83，實際 #147F82`（證明母版期望的是 Professional 值） |

### verify-split.js

- 填色不再與 `components.fig` 比：它的顏色是丟失主題後的預設主題攤平值，Dark 與 Professional 的 frame 本來就與它不同（ISSUE-009 後曾有 302 項差異）。顏色改由 `verify-themes.js` 對 `resolved.json` 驗收。名稱、節點數、文字仍與基準比。
- 新增：同一個設計檔內，名稱只差 `Light`／`Dark` 的兩個 frame 為一組（兩檔共 150 組），顏色分布（frame 與全部後代的填色、描邊顏色，各色出現次數）完全相同就回報 `[明暗相同]`、結束碼 1。
- 已提交的兩檔：exit=0，輸出 `明暗成對：150 組`、`全部一致`（約 14 秒）。
- 證明會失敗（`verify-split.test.js`）：
  - 副本把 `Home/Vibrant/Dark/Desktop/Success` 的 `Mode` 設回 Light（離線存檔會把有綁定的值重新解析成該模式的值，所以存成 Light 的顏色）→ exit=1：`[明暗相同] Home/Vibrant/*/Desktop/Success：vibrant 的 Light 與 Dark 顏色分布完全相同（明暗模式遺失）`。
  - 目前損失內容的真實狀態：`git show 5124b60:docs/mockup/components-vibrant.fig`（加入變數前、Light 與 Dark 同色）→ exit=1，出現 `[明暗相同]`。
  - 文字被改的副本 → exit=1：`[文字] Home/Vibrant/Light/Desktop/Success`。
- 與工單字面的差異：工單寫「移除變數後的副本」。單純刪除變數與綁定而不動儲存色，Dark frame 的儲存色還在，這支腳本不會失敗（那種情況由 `verify-themes.js` 的「未綁定」抓到）；所以這裡用「顏色被攤平」的兩種副本（模式設回 Light、加入變數之前的歷史檔）證明它會失敗。

### check-masters.js

ISSUE-009 後兩檔母版各用自己套系的值，原本的逐值全等會報 220 項差異。改為：

1. 有綁定的屬性：比對綁定的變數名稱（每個節點的綁定表兩檔必須相同），並驗證每檔「儲存值＝自己這個檔案裡該變數的解析值」，不比兩檔的儲存值是否相等。
2. 沒有綁定欄位的 `fill[i].opacity`、`effect.enabled`：每檔的儲存值必須等於 `theme-expected.js` 推導的該套系值（Professional 的 C/State/Loading、C/Card/Metric 因此與 Vibrant 不同）。
3. 其餘屬性（名稱、型別、結構、文字、未綁定的屬性、子節點數量）照舊逐值全等。
4. x／y／寬／高：一個單元內任一節點的版面相關值（內距、間距、描邊粗細、字級、字型名）兩檔不同時，該單元的幾何由這些值決定，不直接比。8 個單元屬於此類（C/Status/Success、C/Status/Warning、C/Status/Error、C/State/Loading、C/State/Empty、C/State/Error、C/Card/Metric、C/Table），輸出會列名；其餘 18 個單元仍嚴格比對幾何。

第 4 點是刻意的取捨：放寬這 8 個單元的幾何比對，換來不必在檢查裡重做 auto-layout。各變數本身的值是否正確由 `apply-variables.js --check` 與 `verify-themes.js` 負責。已提交的兩檔：exit=0（母版 22 對 22，約 12 秒）。

證明沒有被放寬成永遠通過（`check-masters.test.js`，都只改 Professional 檔的母版）：文字被改 → exit=1（`的 characters 不同`）；母版多一個子節點 → exit=1；母版被改名 → exit=1；未綁定的 `opacity` 被改 → exit=1；`cornerRadius` 綁定被移除 → exit=1（`的 bound 不同`）；`fills/0/color` 改綁到 `text` 變數 → exit=1（`的 bound 不同`）；`C/State/Loading` 的 `fill[2].opacity` 改成錯值 → exit=1（`[值與變數不符]`）。

沒有測到的分支：「綁定屬性的儲存值被手改成不等於變數值」。離線存檔時，OpenPencil 會把有綁定的值重新解析成變數值（把填色或圓角改成別的值再存檔，讀回仍是變數值），所以無法用 `.fig` 副本製造這種狀態；該分支的程式碼存在，但沒有測試涵蓋。

### 匯出圖（人眼抽查）

圖用離線 `openpencil export` 匯出，放在 repo 外（`npm test` 會清空 `test-results/`），不進版控：

```sh
openpencil export docs/mockup/components-vibrant.fig --node 0:158 -o <暫存區>/vibrant-home-light-desktop.png
openpencil export docs/mockup/components-vibrant.fig --node 0:332 -o <暫存區>/vibrant-home-dark-desktop.png
openpencil export docs/mockup/components-vibrant.fig --node 0:2701 -o <暫存區>/vibrant-notfound-light-mobile.png
openpencil export docs/mockup/components-vibrant.fig --node 0:2731 -o <暫存區>/vibrant-notfound-dark-mobile.png
# Professional 同樣四個 id，檔案換成 components-professional.fig
```

暫存區：`C:\Users\x1596\AppData\Local\Temp\claude\D--luca-style\13b0e5d5-15e9-44d3-a5df-9bd459ab55c1\scratchpad\img\`（兩檔的 frame id 相同）。

| 套系 | 模式 | frame | 圖檔 |
| --- | --- | --- | --- |
| Vibrant | Light | Home/Vibrant/Light/Desktop/Success（0:158） | vibrant-home-light-desktop.png |
| Vibrant | Dark | Home/Vibrant/Dark/Desktop/Success（0:332） | vibrant-home-dark-desktop.png |
| Vibrant | Light | NotFound/Vibrant/Light/Mobile/Success（0:2701） | vibrant-notfound-light-mobile.png |
| Vibrant | Dark | NotFound/Vibrant/Dark/Mobile/Success（0:2731） | vibrant-notfound-dark-mobile.png |
| Professional | Light | Home/Professional/Light/Desktop/Success（0:158） | professional-home-light-desktop.png |
| Professional | Dark | Home/Professional/Dark/Desktop/Success（0:332） | professional-home-dark-desktop.png |
| Professional | Light | NotFound/Professional/Light/Mobile/Success（0:2701） | professional-notfound-light-mobile.png |
| Professional | Dark | NotFound/Professional/Dark/Mobile/Success（0:2731） | professional-notfound-dark-mobile.png |

代理看過其中 5 張（Vibrant Light 與 Dark 的 Home、Vibrant Dark 的 NotFound、Professional Dark 的 Home、Professional Light 的 NotFound）：Dark 是近黑綠底、淺色字；Light 是淺米白底、深字；Vibrant 強調色為青綠、圓角明顯；Professional 強調色為淡紫（Dark）或灰紫（Light）、圓角極小，Metric 卡片左側有粗邊。顏色與 `variables.json` 相符。其餘 3 張代理沒有逐張看。**人眼抽查仍待使用者確認**：上面是代理的目視，不是使用者確認，也不聲稱像素比對（兩邊渲染器不同，視覺 QA 維持目視）。

### 圖上的疊字：版面是舊的（開放問題）

看過的圖都有文字疊在一起：Home 的大標題壓在麵包屑、說明文字與按鈕上，「從規則，到完整畫面」「繼續探索」壓在下一區塊上，NotFound 的標題壓在麵包屑與說明上，導覽列文字也擠在一起。這是版面問題，不是顏色問題。

- **原因**：`.pen` 轉 `.fig` 時，受變數控制的值被轉壞（基準 `7205b2f` 的 `Home/Vibrant/Light/Desktop/Success`：標題與兩個區塊標題的 `fontSize` 是 `NaN`，圓角、內距、間距多為 0），轉換當下算出的 auto-layout 幾何（文字高度、frame 高度、子節點 y）就是用這些壞值算的，例如 `Page title` 高度為 2。ISSUE-009 把字級（56）、內距、間距寫回正確值，但離線存檔沒有把重算後的幾何存回去。所以**舊幾何在轉換時就有了，ISSUE-009 的綁定把它顯露出來**，不是綁定本身弄壞的。基準 `7205b2f` 沒有可比的好圖：它匯出的圖標題不見、主要按鈕與卡片是黑色、區塊緊貼（另一種壞）；更早的 `5124b60` 匯出幾乎空白（只有麵包屑），因為當時節點帶著指向不存在變數的綁定。
- **離線可否修**：在記憶體裡可以。對一個 frame 的每個文字節點重設 `fontSize` 會觸發重算，`Page introduction` 高度變 123、根 frame 高度變 1117.5、各區塊 y 依序往下。但存檔後重新讀檔，只有部分高度被保留（`Page introduction` 為 123），子節點 y 與根 frame 高度又回到舊值（根 654），再重複一輪「重算＋存檔」也一樣。所以離線存檔無法持久化重算結果，這不是 ISSUE-009 腳本內的小修。我沒有改任何 `.fig`。
- **OpenPencil App**：兩個設計檔都在 App 分頁開著（`tab-1` professional、`tab-2` vibrant；分頁內容可能與磁碟版不同步）。對 vibrant 的 `0:158` 用 `get_node` 讀到：`Page introduction` 高度是 206（離線檔是 46，App 已重算），但它的 y 仍是 125、`Start and style preview` 的 y 是 171、`從規則，到完整畫面` 的 y 是 396、`Footer divider` 的 y 是 1007，根 frame 高度仍是 654；也就是區塊高度在 App 裡被重算了，彼此的位置沒有，區塊仍會互相重疊。App 的 `export_image` 對 `0:158` 回傳 `No visible nodes to export`，所以**我沒有看到 App 的實際畫面**，上面是幾何數字推論，不是目視。
- **建議（待使用者決定）**：在 OpenPencil App 內對每個頁面 frame 觸發一次 auto-layout 重算並存檔（需要一個 App 內的批次做法，或接受以後逐頁編輯時順便修），或另開一張票處理「重建 auto-layout 幾何」。ISSUE-006 結案前使用者需決定是否接受這個狀態；`verify-themes.js` 與其他腳本都不驗版面。

### 其他檢查

- `npm run typecheck`、`npm run lint` 通過；`npm test`（Playwright）72 passed。
- `apply-variables.js --check`：兩檔節點數 5826、變數逐筆一致；`apply-bindings.js --check`：兩檔 175 個 frame／母版、10648 筆綁定全部一致；`build-theme-data.js --check-fig`：9984 條路徑全部一致。三者結束碼皆為 0。兩個套系設計檔仍是 5826 個節點，本票沒有修改任何 `.fig`。

## 版面修正與重疊檢查

2026-10-24，基底 `b388372`，修正提交 `9a2b46e`。ISSUE-009 把正確的字級、間距寫回節點，但離線存檔不保存重算的版面，轉檔時算出的舊版面（行高 `NaN`、標題高度 2px）就留在檔案裡，開啟後大標題、麵包屑、說明與按鈕互相重疊。

| 腳本 | 做什麼 |
| --- | --- |
| `scripts/design/relayout-fig.js`（新） | 修正兩個設計檔：`NaN` 行高改 `AUTO`、含換行的文字逐段量測後改固定高度、重算自動排版並把座標與高度明確寫入。`--check` 為唯讀檢查 |
| `scripts/design/layout-snippets.js`（新） | 檢查與修正的 `openpencil eval` 片段，供上面兩支與 `verify-split.js` 共用 |
| `scripts/design/verify-split.js`（改） | 新增 `[版面]`：`NaN` 行高、相鄰節點重疊、子節點超出父 frame 任何一項大於 0 就失敗 |

```sh
node scripts/design/relayout-fig.js --check
node scripts/design/relayout-fig.js
node scripts/design/verify-split.js
node --test scripts/design/relayout-fig.test.js scripts/design/verify-split.test.js
```

- 修正前（`b388372`，Vibrant）：3,700 組相鄰節點中 318 組重疊、346 個子節點超出父 frame、254 個 `NaN` 行高。修正後三項皆為 0；Professional 修正後同樣為 0。
- 修正後 `verify-themes.js`、`apply-variables.js --check`、`check-masters.js`、`verify-split.js` 都通過，綁定沒有被寫入動作弄丟。
- 證明會失敗：`relayout-fig.test.js` 把 `b388372` 的兩個檔複製到暫存區，`--check` 回報 `NaN 行高 254`、重疊大於 0 且結束碼 1；修正後通過；再修正一次回報「已是最新，不寫檔」。`verify-split.test.js` 的舊檔案例新增斷言 `[版面] vibrant：… NaN`。
- 人眼：只看過 `Home/Vibrant/Light/Desktop/Success` 與 `Dark` 的離線匯出圖，標題、麵包屑、說明、按鈕與卡片不重疊。其他 frame 與 Professional 只有數值檢查，沒有看圖。
- 已知取捨：行高用 `AUTO`（`.pen` 原值取不到）、69 個多行文字改為固定高度、匯出圖底部 `Footer` 文字沒有畫出來（座標與可見性正常，原因未查）。
- 檢查只涵蓋「同一自動排版 frame 內相鄰子節點」，不含非自動排版的絕對定位節點，也不是像素比對。
