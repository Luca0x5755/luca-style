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
