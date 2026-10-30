# 設計系統交付驗證

## Windows 上執行 openpencil 的本機修補

`scripts/design/` 的腳本都以離線 `openpencil eval` 讀寫設計檔。Windows 上 openpencil 需要兩處本機修補，否則會出現 `ENOENT D:\C:\Users\...\canvaskit.wasm`：在全域 npm 目錄 `@open-pencil/cli/node_modules/@open-pencil/core/dist/` 下的 `io/formats/raster/headless.js` 與 `canvaskit.js`，以 `fileURLToPath` 取代直接使用 `URL.pathname`。重新安裝套件會還原修補，需再套用一次。

離線處理是刻意的：在 App 內大量刪除節點會讓 WebAssembly 渲染器損壞並使 App 當機。切檔用的一次性腳本 `split-by-suite.js` 已隨來源 `components.fig` 刪除，提交 `ebe6c61` 找得回。

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

2026-10-24，ISSUE-003（PR-FILE-03、PR-FILE-04）。（ISSUE-006 之後基準改為 `docs/mockup/themes/baseline.json`，下文的 `components.fig` 是當時的基準檔，已刪除。）`scripts/design/verify-split.js` 以 `docs/mockup/components.fig` 為基準，用離線唯讀的 `openpencil eval` 比對 `components-vibrant.fig` 與 `components-professional.fig`：原檔 302 個 frame 的名稱須全部被兩檔合計涵蓋、套系 frame 不得同時出現在兩檔，並逐 frame 比對節點數（frame 加全部後代）、文字（後代 TEXT 的 characters，依樹序）與填色（frame 與全部後代的 fills）。`Library guide`、`00 / Canvas directory` 兩個共用 frame 兩檔各一份，須與原檔一致，不受「不得同時出現」限制。母版與頂層 TEXT 不在本腳本範圍。結束碼：0 全部一致、1 有差異（逐行列出 `[標籤] frame 名稱：說明`）、2 讀檔失敗。不做逐像素比對。

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

承諾全文、範圍、排除項目及決策已遷移至[設計系統需求承諾](capabilities/design-system.md#需求承諾)，本表涵蓋 PR-STYLE-01～24；0.2.0 新增的 PR-STYLE-25～47、PR-FILE-16～19 與 retired 的 PR-FILE-01～05、10～15 見該文件，證據在各自的測試檔（以承諾 ID 標註）與下方各節。下列證據使用真實套件與瀏覽器，不以靜態設計稿 frame 代替 React 驗收。

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
| PR-STYLE-14 | 正式 tokens/react 套件、showcase 五頁、元件庫設計檔（`docs/mockup/luca-style-library.fig`，ADR 0007）、consumer-guide、examples/consumer；test:consumer 從 tarball 於 repo 外安裝、typecheck、build、瀏覽器操作。 |
| PR-STYLE-15 | 本機：pages.spec 對 `build:pages` 輸出的模擬 Pages 伺服器，subpath.spec 於 `/luca-style/` 經導覽到達五個路由。**線上尚未驗證**：需 push 到 `main` 並將 Pages 來源設為 GitHub Actions，詳見下節。 |
| PR-STYLE-16 | pages.spec：每個路由各有 `index.html`、直接開啟與重新整理回應 200；trailing-slash.spec：尾斜線與無尾斜線同一路由；模擬伺服器重現 Pages 對無尾斜線目錄的 301。 |
| PR-STYLE-17 | pages.spec 未知網址回 404；not-found.spec 與 subpath.spec：找不到頁面內容、四態、返回入口、三寬度無橫溢。 |
| PR-STYLE-18 | subpath.spec：品牌連結與頁內連結皆在 `/luca-style/` 內；`/` 下既有案例不變。route-table 單一來源與 main.tsx 由 pages-routes.spec 比對。 |
| PR-STYLE-19 | deploy-workflow.spec：push 到 main 與 PR 觸發、只有 push 才部署、deploy 依賴 verify、build→typecheck→lint→test 順序、無 continue-on-error、action 固定 SHA、權限最小。2026-10-29 PR #4 在 GitHub Actions 實跑（run 40803527031）：verify、visual 通過，deploy 依條件跳過；推到 main 的部署尚未實跑。 |
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

以[前端 §5.1–5.5.4](05_frontend_spec.md)及[公開對應表](consumer-guide.md#openpencil-與程式同步)核對同名色彩／字體角色、22 母版對應的正式元件、產品與介紹頁代表結構。先前以 Pencil（當時工具，設計稿為單一 components.pen，先由 ADR 0003 拆成兩檔，現為元件庫設計檔 `docs/mockup/luca-style-library.fig`，見 ADR 0007）實際 QA 已確認 22 母版、12 檢視板、240 唯一 frame；各頁三寬度與 15 個 fallback 樣本曾目視核對。雙套系分區為左側 Vibrant、右側 Professional。這些是既有設計證據，本輪沒有重新開啟 components.pen：當時 Pencil MCP 開啟的是其他專案的設計檔，未讀取 .pen 的檔案系統內容，亦未修改其他設計檔。

實作保留設計角色與內容層次，以下差異由可操作網頁需要而來：

- 當時的 Pencil 設計稿分立 240 個靜態 frame；React 使用單一頁面與本機「樣張狀態」選單，錯誤重試回復正常內容。
- 當時的 Pencil 設計稿以狀態母版獨立展示；React 以 props、原生 disabled、hover、focus-visible 與可關聯錯誤文字實際操作。
- 網頁增加套系、模式及強調色比較控制供開發者檢視；正式使用端仍選定專案套系。表單元件當時使用原生選單／核取方塊；0.2.0 起 Select、Checkbox 等改由 Base UI 處理互動（ADR 0006），Select 選單跟著套系與明暗。
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

- `variables.json`：擷取當時是 48 個變數的型別、原始定義，以及在 12 個主題組合（mode × suite × device，鍵為 `Light/Vibrant/Desktop` 這種格式）下的值。ISSUE-003 起改由 `npm run generate` 自 DTCG 原始檔產生（程式變數與這 48 個的聯集；格式相同但不含原始定義 `definition`，沒有腳本讀它），本腳本不再寫出它；擷取當時的 48 個變數保存在 `tests/fixtures/fig-variables-0.1.0.json`。
- `bindings.json`：每個頁面 frame 的每個被綁定屬性：frame 名稱、節點索引路徑、節點類型、屬性、變數名稱；母版另存在 `masters`。
- `resolved.json`：每個頁面 frame 在自己的主題下，每個被綁定屬性解析後的實際值；母版以預設主題（Vibrant／Light／Desktop）解析。opacity 類變數保留原值 0–100，不做 Pencil 內部的 0–1 正規化。
- `extract-raw.txt`、`variables-raw.txt`：從 Pencil 抽出的原始文字，是 `bindings.json`、`resolved.json` 的唯一輸入；`variables-raw.txt` 的值只在建置時用來解析 `resolved.json`。

### 檔案大小與筆數

「筆數」：bindings.json 與 resolved.json 為展開後的綁定總數（頁面 frame 20,846＋母版 212）。兩份都遠低於 5 MB，所以維持單檔，不分套系。

| 檔案 | bytes | 筆數 |
| --- | --- | --- |
| bindings.json | 906116 | 21058 |
| resolved.json | 765053 | 21058 |

涵蓋範圍：304 個頂層項目（302 個頁面 frame 加兩個頂層標題文字）與 22 個母版；展開後共 11,444 個頁面節點、94 個母版節點。未展開時 `.pen` 內的 `$` 引用為頁面 7,930 筆、母版 207 筆（工單寫的「約 7,500」是估計；母版內的引用在每個實例裡會再展開一次，所以展開後的筆數較多）。逐類型筆數：fill（frame 2,091、text 6,122、icon 839、rectangle 624）、stroke 1,883、strokeWidth 451、fontFamily 6,122、fontSize 508、gap 288、padding 170、cornerRadius 1,434、effect.enabled 85、strokeWidth.left 85、fill 的四個 opacity 各 89；完整表見腳本 `--check` 的獨立計數。

### 重做步驟

（`components.pen` 已於 ISSUE-006 刪除；要重做需先從提交歷史取回它，最後存在的提交是刪除前一個。）

1. 開啟 Pencil 並載入 `docs/mockup/components.pen`（加密檔，只能經由 pencil MCP 的 `execute` 存取，不可修改）。
2. 依 `scripts/design/extract-pen-themes.pen.js` 的片段 1 印出變數，存成 `docs/mockup/themes/variables-raw.txt`。
3. 依片段 2 印出綁定（Pencil 不能寫檔，輸出經對話複製成文字檔；太長就調大 `START` 分批，前 `START` 個 frame 只重放不輸出，編號才會一致），存成 `extract-raw.txt` 的主體。末行應為 `BAD total 0 … frames 304 masters 22`；0 代表離線推導的值與 Pencil `resolveVariables` 的結果逐筆相同。
4. 依片段 3 取得四行 `#independent-count`，連同 `#pencil-resolve-check mismatches=0 frames=304 masters=22` 放在 `extract-raw.txt` 最前面。
5. 執行：

```sh
node scripts/design/build-theme-data.js              # 建置 bindings.json 與 resolved.json
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
- `resolved.json` 的值由 `variables-raw.txt` 加主題推導；與 Pencil 的 `resolveVariables` 結果一致這件事，是在 Pencil 內對 304 個頁面項目與 22 個母版逐筆比對得到的（BAD total 0），該結果記在 `extract-raw.txt` 檔頭。`.pen` 刪除後這項比對無法重跑，只能用片段 2 重現當時的做法。

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

### MCP `set_fill` 驗證：當時未完成，已於 ISSUE-009 補驗

OpenPencil App 在這次執行中，`open_file` 對 `components-vibrant.fig` 的副本、`HEAD` 版本（沒有變數）的副本與原檔都回傳逾時（或 `ResourceCache cleanup failed`），等待超過 10 分鐘仍未出現在 `list_documents`；App 本身有回應（`list_collections` 對既有的小分頁正常）。因為連沒有變數的 `HEAD` 版本也打不開，這不是變數造成的，是 App 目前載入大檔失敗，所以無法完成 MCP `set_fill` 驗證。替代證據（不等同 MCP）：離線 `openpencil eval` 把套用變數後的 vibrant 副本中葉節點 `Footer divider`（RECTANGLE）填色改為紅色並另存，重新讀檔後填色已改且 48 個變數仍在。ISSUE-008 因此帶著這一項未驗就結案；後來在 ISSUE-009 補驗，兩檔皆通過（見該節 MCP 驗證）。

### 重新讀檔列出的值

兩檔的 48 個變數逐筆值不在此重列：`node scripts/design/apply-variables.js --list` 可重新讀出，`--check` 逐筆比對 `docs/mockup/themes/variables.json`。

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

### 圖上的疊字：版面是舊的（已解決）

當時看過的圖有文字互相重疊。原因是 `.pen` 轉 `.fig` 時受變數控制的值被轉壞，轉換當下算出的 auto-layout 幾何（`NaN` 行高、標題高度 2px）留在檔案裡，ISSUE-009 寫回正確字級與間距後把它顯露出來；離線存檔不保存重算結果。後續提交 `9a2b46e` 與 `574ad4c` 以 `relayout-fig.js` 修正，並由 `verify-split.js` 驗收（PR-FILE-14），做法與結果見〈版面修正與重疊檢查〉。

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

## 人眼抽查與退役 `.pen`、`components.fig`（ISSUE-006）

2026-10-24。

- **人眼抽查：** 使用者在 OpenPencil App 逐一開啟 `components-vibrant.fig` 與 `components-professional.fig`（一次一個檔案），回報「沒有問題」。使用者沒有說明看了哪些 frame，所以這裡**不記**成「每頁各 2 個代表 frame」，也不聲稱做過像素比對。我另外只用離線匯出圖看過 `Home/Vibrant/Light/Desktop/Success` 與 `Dark` 兩張。
- **基準改為 JSON：** `verify-split.js` 原本以 `components.fig` 為基準。刪除它之前，先把 302 個 frame 的名稱、節點數與文字雜湊存成 `docs/mockup/themes/baseline.json`（來源是提交 `ebe6c61` 的 `components.fig`），`verify-split.js` 改讀它；改讀前後的驗收結果相同（套系 frame 300、共用 2、明暗成對 150 組、全部一致）。
- **已刪除：** `docs/mockup/components.fig`、`docs/mockup/components.pen`。兩者都能從提交歷史取回：`components.pen` 在本提交的前一個提交仍存在。`split-by-suite.js` 與 `extract-pen-themes.pen.js` 因此無法重跑，檔頭已註明，只留作做法與 Windows 修補的紀錄。
- **ADR 0003** 改為 `Accepted`；`PR-FILE-01～14` 移入 `docs/capabilities/design-system.md`（PR-FILE-04 改成對 `baseline.json` 比對，並新增 PR-FILE-14 版面檢查）。

## 依產品頁面分畫布頁（PR-FILE-15）

2026-10-24。兩個套系設計檔原本把 176 個頂層 frame 全放在 `Library guide` 一個畫布頁，OpenPencil 常當掉；改為依產品頁面分頁。

- **指令：** `node scripts/design/paginate-fig.js`（分頁，已是最新不寫檔）、`--check`（唯讀）。規則在 `scripts/design/pages.js`，`verify-split.js` 共用同一份。
- **結果（兩檔相同）：** 搬移 144 個 frame、新增 6 個畫布頁。`Library guide` 32 個 frame／482 節點，Home 24／674，Foundations 24／1,114，Components 24／1,406，Product 24／926，Intro 24／740，NotFound 24／482；合計 5,824 節點，與分頁前相同。711 個實例全部仍連得到母版。
- **驗收：** `verify-split.js`（跨畫布頁，新增 `[畫布頁]` 檢查）、`verify-themes.js`、`check-masters.js`、`apply-bindings.js --check`、`apply-variables.js --check`、`build-theme-data.js --check-fig`、`relayout-fig.js --check` 都通過。
- **未驗證，也沒有改善的證據：** 在 App 裡開啟分頁複本後切換畫布頁，使用者回報仍出現 `Uncaught RuntimeError: table index is out of bounds`（29 次）與 `ResourceCache cleanup failed`。使用者判斷這是 OpenPencil 本身的問題、對方修復中，仍要求分頁。所以分頁**不保證**減少當機，也沒有在 App 內做過前後對照；本節只證明檔案結構與內容沒有被分頁弄壞。
- **節點數：** `apply-variables.js --check` 與 `apply-bindings.js --check` 回報的文件節點數從 5826 變成 5832，因為文件節點把每個畫布頁也算進去（2 頁變 8 頁，頁內節點仍是 5,824）；上文 ISSUE-009、010 兩節的 5826 是分頁前的數字。
- **取捨：** 每頁節點數上限暫不設；10,000 節點的 MCP 上限仍是整份文件合計，分頁不影響。

## 以 Mode 切換取代 Dark 頁面 frame 的試驗（ISSUE-001）

2026-10-24，基底 `4e9b563`。問題：頁面 frame 拿掉 Mode 固定後，能否由畫布頁的 Mode 切換顯示 Light 與 Dark，讓每頁不必再畫 Dark 那一份。**結論：目前不能直接取代，這次試驗沒有支持全面改。** 只試 Vibrant 一個 frame，沒有試 Professional、其他頁面與 Tablet、Mobile。正式的兩個 `.fig` 與規格沒有修改。

**做法**：複製 `components-vibrant.fig` 到 `test-results/probe/t1.fig`（git 忽略），以離線 `openpencil eval` 的 `figma.graph.updateNode(id, { variableModes })` 把 `Home/Vibrant/Light/Desktop/Success` 的 `variableModes` 由 `{Mode: Light, Device: Desktop}` 改為 `{Device: Desktop}`。`clearExplicitVariableModeForCollection` 不存在，直接指定 `explicitVariableModes` 被忽略（沒有 setter）。

**離線結果**：存檔後重讀，該 frame 只剩 Device 固定；節點 5,832、實例 711、連不到母版 0、其他 Light 與 Dark frame 的 Mode 固定都不變。

**App 結果**（使用者在 App 畫布頁把 Mode 切到 Dark，我讀值）：
- 被拿掉固定的 frame 整體變深色，標題與一般文字也轉淺色，切換本身有作用；母版（沒有固定模式）也確認會跟著切換。
- **但 Style preview 裡的 `C/Card/Metric instance` 背景仍是淺色（`#e3f2f0`），而 `Metric value` 文字轉成淺色，數字 `128,640` 幾乎看不見**。對照原本的 Dark frame，同一張卡片背景是 `#173637`、數字是 `#edf3ed`。代表這張卡片的顏色沒有跟著 Mode 變，與 Dark frame 並不相同；原因（實例覆寫或節點沒有綁定變數）沒有查。這是這次唯一確認的畫面差異，沒有逐節點比對其他區塊。
- **原本固定為 Dark 的 `Home/Vibrant/Dark/Desktop/Success`，在使用者切換後顯示為淺色**。原因未查，可能與畫布頁 Mode 和 frame 固定的互動有關，沒有證據。
- MCP `get_node`：`fills` 是節點存的值，不隨 Mode 變（拿掉固定的 frame 仍是 `#F7F7F2`）；`boundVariables.resolvedValue` 一律是 Light 預設值，連固定為 Dark 的 frame 也是。所以 MCP 讀值無法用來驗證切換結果。
- MCP `export_image`：兩次回 `memory access out of bounds`（maxEdge 900、600），沒有圖。不確定是否與拿掉固定有關。
- 使用者切換後 App 重新整理分頁（`tab-5` 變 `tab-2`），原因未查。

**若要全面改，需要先解決的事**
- 找出並修正「切到 Dark 沒有跟著變」的節點（例如上述 Metric 卡片），再逐頁確認，否則 Dark 畫面會與現有 Dark frame 不同。
- 釐清固定為 Dark 的 frame 在畫布頁 Mode 為 Dark 時顯示淺色的原因。
- 驗證匯出與讀值在拿掉固定後是否正常；目前匯出本身會失敗。
- 之後要改的文件與腳本：規格 §5.3 的 48 張矩陣、PR-FILE-04 與 `baseline.json`（302 個 frame）、`verify-split.js` 的 Light/Dark 顏色分布檢查、`verify-themes.js`、`apply-bindings.js` 的 frame 模式。
- 本試驗**沒有**證明可行，也沒有證明不可行；比對只有一個 frame 的目視與數個讀值。

## 合併為一份元件庫設計檔（ISSUE-004，PR-FILE-18）

2026-10-28。`docs/mockup/luca-style-library.fig` 取代 `components-vibrant.fig` 與 `components-professional.fig`（ADR 0007）；舊檔與只為頁面、兩檔比對存在的腳本、基準資料已刪除（`paginate-fig`、`relayout-fig`、`verify-split`、`pages.js`、`layout-snippets.js`、`build-theme-data`、`verify-themes`、`extract-pen-themes.pen.js`、`theme-expected.js`、`themes/` 的 baseline、resolved、extract-raw、variables-raw、strokes），上文各節的指令是當時的紀錄。

- **合併前提：** 兩檔母版只在綁定變數上不同。`check-masters.js`（舊版）全部相同；另以一次性腳本逐節點比對 23 個母版的節點樹、子節點數、`layoutMode`、sizing 與元件屬性定義，差異 0。兩檔的頂層非母版節點只有 `Library guide`、`00 / Canvas directory` 與兩個標題文字，皆為頁面或比對專用。
- **檔案：** 23 個母版、110 個母版節點，文件節點數 112（含存放變數的空頁 `Internal Only Canvas`，OpenPencil 在檔案含變數時自動維持，無法刪除，所以「有內容的畫布頁」只有 1 個）。
- **模式：** ISSUE-004 時為五個集合 Base、Suite、Mode、Device、Suite x Mode，Suite x Mode 放 14 個同時依套系與明暗變化的變數；ISSUE-015 把 Suite、Mode 併入 Suite x Mode，現為 Base、Device、Suite x Mode 三個集合（Suite x Mode 30 個變數）。探測：`VARIABLE_ALIAS` 可儲存，但 `resolve*VariableForNode` 回傳 undefined，匯出退回儲存值（灰色方塊仍為灰），所以不能用別名拆進 Suite 與 Mode。集合與歸屬由 `npm run generate` 決定（`variables.json` 的 `collections`）。
- **解析值：** `check-masters.js` 對 Vibrant／Professional × Light／Dark 四種組合設定模式後，245 筆綁定屬性的解析值都等於 `variables.json`。
- **母版總覽 PNG：** 四種組合各一張（`-s 2`，臨時 frame 內 23 個實例，母版順序固定），與合併前兩檔以同方式匯出的基準逐列比對（不進版控）。Vibrant 兩張只在預期處不同：`C/Button/Hover`（改綁 `accent-hover`）、`C/Button/Focus` 與 `C/Field/Focus`（焦點框改綁 `focus-ring`）、`C/Card/Metric` 左邊框（改綁 `border`）、Dark 的 `C/Select/Open` 選單外框（原本是未綁定的日間色，改綁 `border`）。Professional 在這些之外，指標卡與表格因自動排版尺寸只存預設模式的值，總高度差 32px（6128 對 6096）。
- **限制：** 圓角、內距、字級、字型、顏色隨模式解析；但沒有綁定欄位的陰影開關（`elevation-enabled`）與載入圖片透明度（`loading-*-opacity`），以及自動排版後的版面尺寸，只存預設模式的值。離線匯出不會因模式重排版，總覽 PNG 以匯出前把綁定的數值寫進實例的方式補上；App 內的行為未驗證。
- **未綁定項：** 沒有按下態母版，`accent-pressed` 無處綁定，未新增母版。

## 元件庫設計檔的檢查指令與結果（PR-FILE-06）

2026-10-28，ISSUE-014 收尾時在 Windows 本機對 `docs/mockup/luca-style-library.fig` 執行（三支腳本都以離線、唯讀的 `openpencil eval` 讀檔）：

```sh
node scripts/design/check-masters.js            # exit 0
node scripts/design/apply-variables.js --check  # exit 0
node scripts/design/apply-bindings.js --check   # exit 0
```

- `check-masters.js`：畫布頁 Library（23）、Internal Only Canvas（0）；母版 23（預期 23）、母版節點 110；245 筆綁定屬性在 Vibrant／Professional × Light／Dark 四種組合的解析值都等於 `variables.json`，「全部通過」。
- `apply-variables.js --check`：節點數 112，變數與 `variables.json` 逐筆一致。
- `apply-bindings.js --check`：節點數 112，23 個母版、244 筆綁定，綁定與儲存值全部一致。
- 三支腳本各自的 `*.test.js`（含故意改壞副本的失敗案例）在 `node --test scripts/design/*.test.js` 內執行。
- **人眼抽查：** 2026-10-29 使用者在 OpenPencil App 開啟元件庫設計檔檢查，回報「已經看完沒問題」（在 ISSUE-015 合併集合與 `c5cd3fc` 文字置中之後）。使用者沒有說明看了哪些母版與模式，所以這裡不記抽查範圍，也不聲稱做過像素比對。

## Penpot 試點：母版與 theme 切換（ISSUE-018、ISSUE-019，PR-FILE-20）

2026-10-30，在連線的暫存檔「嗨嗨」以 Penpot 外掛 API（MCP `execute_code`）操作；暫存檔不進 repo，建置用的一次性腳本也不留。token 來自 `docs/mockup/themes/penpot-tokens.json`（8 個 set、7 個 theme，各 theme 啟用 Base 加一個 set）。

**母版與綁定。** `C/Button/Primary`（ISSUE-018）、`C/State/Loading`、`C/Nav/Mobile` 三個母版都是板（board），沒有轉成元件。綁定依 `bindings.json`：

- `C/State/Loading`（4 個形狀加外框）：外框 fill `surface`、stroke `border`、圓角 `radius-card`、描邊寬 `border-width`；標題 fill `text`、說明 fill `muted`，字型 `font-zh`；四張圖各一個矩形，不透明度分別綁 `loading-tide-light-opacity`、`loading-tide-dark-opacity`、`loading-square-light-opacity`、`loading-square-dark-opacity`。另外為了觀察 hug，外框內距綁 `card-padding`（`bindings.json` 沒有列在這個母版）。
- `C/Nav/Mobile`（2 個節點）：fill `surface`、stroke `border`；Logo fill `text`、字型 `font-en`。另外為了觀察 hug，Logo 字級綁 `fs-section`（`bindings.json` 沒有列）。
- 載入圖片是替身：四張 24x24 純色 PNG（tide 兩張為青綠系，square 兩張為灰系），不是 `packages/react/loading/*.png`。原因：手動複製 base64 到外掛程式碼時出錯，`uploadMediaData` 回 `http error`；`uploadMediaUrl` 抓本機 HTTP 也回 `http error`（Penpot 後端抓不到，或不允許）。透明度是否切換與圖片內容無關，但這裡沒有證明真實圖片可用。

**解析值比對。** 對 Suite x Mode 四種 x Device 三種（共 12 組）逐組切換後讀回，與 `variables.json` 比：Loading 的 surface、border、text、muted、radius-card、border-width、四個 opacity；Nav 的 surface、border、text、字級 `fs-section`（Desktop 24、Tablet 22、Mobile 20）。12 組、全部欄位差異 0。顏色為十六進位大寫字串全等；`C/Button/Primary` 的比對見 ISSUE-018。

| Suite x Mode | surface | border | text | muted | radius-card | border-width |
| --- | --- | --- | --- | --- | --- | --- |
| Vibrant / Light | #FFFFFF | #E0E2E6 | #2C2E31 | #696B6F | 20 | 1 |
| Vibrant / Dark | #1A1D22 | #3C3E41 | #EFF1F5 | #AEB0B4 | 20 | 1 |
| Professional / Light | #FFFFFF | #E0E2E6 | #2C2E31 | #696B6F | 3 | 1.5 |
| Professional / Dark | #1A1D22 | #3C3E41 | #EFF1F5 | #AEB0B4 | 3 | 1.5 |

`C/Nav/Mobile` 只用 surface、border、text 三欄，值同上表。`muted`、`radius-card`、`border-width` 只在 Loading 驗證。

**`.fig` 只存預設模式的三項，在 Penpot 是否隨 theme 切換。**

- hug 版面尺寸：會。`C/Nav/Mobile` 自動高度隨 `fs-section` 變，Desktop 53、Tablet 51、Mobile 48；`C/State/Loading` 內距綁 `card-padding` 後高度 Vibrant 181、Professional 173（內距 24 對 20）。限制：只驗證字級與內距這兩種綁定引起的 hug；沒驗證 `gap-section` 與其他尺寸綁定。
- 陰影開關：值會隨 theme 變，但「關」只能用零偏移、零模糊、透明度 0 的陰影表示，形狀上仍留著一筆 `hidden: false` 的陰影，不是真的沒有。探測用的 `shadow` token（Vibrant 兩組 0/4/12 模糊、透明度 0.2 與 0.4；Professional 兩組全零透明）綁在一塊探測板上，四組合讀回的 `shadows` 都跟著變。探測 token 與探測板已移除，母版沒有綁陰影。`elevation-enabled` 是布林，`penpot-tokens.json` 不輸出，所以正式做法要新增一個 shadow token（要改建置輸出與測試）。
- 載入圖片不透明度：會，且可以每個 Suite x Mode 恰好顯示一張。Penpot 的不透明度 token 綁在形狀上（不是填色的第幾層），所以做法是四個疊在一起的矩形各綁一個 token，不是一個形狀四個填色。12 組讀回的不透明度為 Vibrant/Light 1,0,0,0、Vibrant/Dark 0,1,0,0、Professional/Light 0,0,1,0、Professional/Dark 0,0,0,1（順序 tide-light、tide-dark、square-light、square-dark），與 `variables.json` 一致。`export_shape` 目視抽查一次（Professional / Dark / Mobile 只看到深灰替身圖）；沒有逐組目視。

**`font-zh` 的 `fontFamilies` 綁定（ISSUE-018 遺留）：** 有替代方法。`applyToken(token, ['fontFamilies'])` 一律失敗（錯誤 `should be a set of strings`），連值是單字 `Inter` 的 token 也失敗，所以不是 token 值格式的問題（加引號、逗號分隔都一樣）。不傳 `properties`（`applyToken(token)`）會成功，綁成 `fontFamily`，`fontFamily` 讀回 `Noto Sans TC`（`gfont-noto-sans-tc`）與 `Inter`。已把 `font-zh` 綁在 `C/Button/Primary` 標籤與 Loading 標題、說明，`font-en` 綁在 Nav Logo。注意 `token.resolvedValue` 會把 `Noto Sans TC` 拆成 `[["Noto","Sans","TC"]]`，單字字型不會；沒有影響綁定結果。

**暫存檔現況：** 頁面上三個母版（`C / Button / Primary`、`C / State / Loading`、`C / Nav / Mobile`；Penpot 把名稱的斜線兩側補上空白）。token 沒有改動：探測用的 7 個 token 已刪除，8 個 set 的 token 數仍是 39、28x4、3x3。目前啟用 Professional / Dark 與 Mobile。

## Penpot：以 shadow token 表示陰影開關（ISSUE-024，PR-FILE-33）

2026-10-30，建置另外輸出 `metric-shadow`：每個 `Suite x Mode/*` set 一個 `shadow` token，值取自該套系與明暗已解析的 DTCG `metric-shadow`。開（Vibrant）為 `0 4px 16px #00000008`，輸出為 `offsetX 0、offsetY 4、blur 16、spread 0、color #00000008、inset false`；關（Professional，DTCG 為 `none`）為 `0/0/0/0、color #00000000`。離線測試（`tests/penpot-tokens.spec.ts`）以獨立的 `tokens.json` 比對 4 個組合，並驗證改 DTCG 陰影值會改 token。`elevation-enabled` 的設計檔布林輸出不變；已發布的 `@luca-style/tokens` 輸出不變（只有 `penpot-tokens.json` 重新產生）。

**暫存檔驗證**（MCP `execute_code`，同日）：Penpot 沒有匯入 JSON 的外掛 API，所以以 `set.addToken({ type: 'shadow', name: 'metric-shadow', value: [組合物件] })` 對 4 個 Suite x Mode set 各加一個 token（值逐欄與 `penpot-tokens.json` 相同，`inset` 為字串 `'false'`），不是實際匯入檔案；匯入該 JSON 的路徑未驗證。目前母版沒有綁陰影，所以建一塊探測板，先給一筆紅色 1/1/1 的陰影，再 `applyToken(token, ['shadow'])`（API 屬性 `shadow` 可用，綁定一次成功，`tokens` 讀回 `{ shadow: 'metric-shadow' }`）。依序切換 4 個 Suite x Mode theme（Device 維持 Mobile；每次切換後等 700 ms 讀回 `shadows`）：

| Suite x Mode | 陰影筆數 | offsetX / offsetY / blur / spread | 顏色 | 不透明度 | hidden |
| --- | --- | --- | --- | --- | --- |
| Vibrant / Light | 1 | 0 / 4 / 16 / 0 | #000000 | 0.0314（8/255） | false |
| Vibrant / Dark | 1 | 0 / 4 / 16 / 0 | #000000 | 0.0314 | false |
| Professional / Light | 1 | 0 / 0 / 0 / 0 | #000000 | 0 | false |
| Professional / Dark | 1 | 0 / 0 / 0 / 0 | #000000 | 0 | false |

與 `variables.json` 的 `elevation-enabled`（Vibrant 開、Professional 關）和 DTCG 陰影值一致，4 組差異 0。限制：只驗證 Device 為 Mobile；「關」仍是一筆 `hidden: false` 的零值陰影（PR-FILE-33 已接受）；沒有目視。探測板已移除，4 個 Suite x Mode set 各留下 `metric-shadow`，token 數由 28 變 29；目前啟用 Professional / Dark 與 Mobile。

## Penpot 試點：離線解析匯出檔（ISSUE-020，PR-FILE-23）

2026-10-30，使用者手動從暫存檔「嗨嗨」匯出 `hihi.penpot`（34,111 bytes，41 個條目，`generatedBy: penpot/2.18.5-RC1`，匯出格式 `penpot/export-files` 版本 1）。匯出檔是不受信任的資料：另解到新的空目錄檢視，原檔未動；試點腳本只在記憶體內讀 zip。匯出檔不進 repo。

```sh
node scripts/design/parse-export.mjs <匯出檔.penpot> [--json]
node --test scripts/design/parse-export.test.mjs
```

**腳本結果**（結束碼 0）：檔案「嗨嗨」、媒體 4、母版 3（`C / Button / Primary`、`C / State / Loading`、`C / Nav / Mobile`）、token set 8、theme 7。測試 19 項全過（由 `fixtures/minimal-export.json` 即時組 zip；含 store 與 deflate、非 zip、缺 manifest、壞 JSON、無母版、懸空 token 綁定、路徑可疑、子節點循環、壞壓縮資料、解壓總量超限、manifest id 含正規表示式字元、檔案不存在、用法錯誤）。

**與 Penpot 內實際內容比對**（同日以 `execute_code` 讀回）：3 個頂層形狀的型別為 `board`，名稱相同；8 個 set 的 token 數 39、28x4、3x3，7 個 theme 的群組與名稱相同；每個形狀的 token 綁定與匯出檔一致（只差鍵名，見下）。`library.local.components` 長度為 0，與匯出檔沒有元件資料相符。

### 壓縮檔結構

- `manifest.json`：型別、版本、`generatedBy`、檔案清單（id、名稱、features）。
- `files/<檔案id>.json`：檔案層資料（名稱、`revn`、`modifiedAt`、`migrations` 清單），不含頁面內容。
- `files/<檔案id>/pages/<頁面id>.json`：頁面 id、名稱、索引；每個形狀一個檔，`pages/<頁面id>/<形狀id>.json`，另有根 frame（id 全零，名稱 `Root Frame`）的 `shapes` 陣列給出頂層順序。形狀以 `parentId`／`shapes` 連結，不是巢狀。
- `files/<檔案id>/tokens.json`：所有 token set（鍵為 set 名稱）、`$themes`、`$metadata`（`tokenSetOrder`、`activeThemes`、`activeSets`）。
- `files/<檔案id>/media/*.json`、`objects/*.png` 與 `*.json`：載入圖片替身（4 張）與縮圖；`thumbnails/frame/…`：板的縮圖記錄。

### 離線可讀與不可讀

| 項目 | 離線可讀 | 說明 |
| --- | --- | --- |
| 母版名稱與數量 | 是 | 頁面根 frame 的 `shapes` 中 `type: frame` 的直接子節點。巢狀的 `Loading image` 板不算；母版是板，不是元件。 |
| token set 與 theme | 是 | 8 個 set、7 個 theme（群組、名稱、各自啟用的 set）。比對 160 個 token：全部在字面上不同，原因是匯出檔多 `$description: ""`，且 `fontFamilies` 值包成陣列（`["Inter"]`）；正規化這兩處後仍有 12 個不同，全是來源值 `0%` 在匯出檔變成 `0` 的不透明度 token（值為 0 的那幾個），數值相同、寫法不同。正式比對要正規化這三處。theme 與 set 的順序不一致：`tokens.json` 的鍵序是雜湊序，順序以 `$metadata.tokenSetOrder` 為準。 |
| 每個形狀的 token 綁定 | 是 | 讀 `appliedTokens`，但鍵是儲存用的短鍵，與外掛 API 的屬性名不同：字型綁定為 `fontFamily`（不是 `fontFamilies`）、`fontSize`；填色 `fill`、描邊 `strokeColor`、`strokeWidth`、`opacity`；圓角 `r1`～`r4`（API 為 `borderRadiusTopLeft` 等）；內距 `p1`～`p4`（API 為 `paddingTop` 等）。 |
| 解析後的值（PR-FILE-27 離線檢查） | 部分 | 形狀上存的是匯出當下啟用的 theme 的解析值（本檔為 Professional / Dark 加 Mobile，並記在 `$metadata.activeThemes`），其他 theme 的值不在形狀上，必須由 `tokens.json` 的 set 重新解析。以一次性腳本驗證：用 `activeSets` 解析 28 筆綁定（fill、strokeColor、strokeWidth、圓角、不透明度、字型、字級），27 筆與形狀儲存值相同；1 筆差異只是單位（token 值 `100%`、形狀存 `1`）。內距 `p1`～`p4` 未比（形狀存的是 `layoutPadding`）。文字節點的色彩與字型在 `content` 樹的 run 上，不在形狀頂層。所以離線檢查母版名稱、數量、綁定鍵與 token 是否存在可行；逐 theme 比對解析色彩則要自寫 set 解析（最後啟用者覆蓋），可行但是額外工作。 |
| 母版是否為元件 | 未驗證 | 匯出檔沒有元件，腳本以 `componentId`／`mainInstance` 欄位名判斷是猜的，沒有真實元件可驗。 |
| 載入圖片真實內容 | 不適用 | 圖片是純色替身，且 `objects/*.png` 是 Penpot 產生的縮圖。 |

### 能否提交進 repo

- 大小：34 KB，是二進位 zip，審查時看不出差異；若要進版控，需另有展開文字檢視（本腳本的 `--json` 可當一種）。真實母版（23 個含 Select）的大小未測；形狀每個一個 JSON，每個約 1.3 至 3 KB，粗估 23 個母版加子節點在數百 KB 之內，是估計不是量測。
- 決定性：只有一次匯出，無法實測兩次匯出是否位元組相同，因為 `File.export` 這次在外掛端回 `No matching clause`，無法從 Penpot 重匯。從這一份可見的不穩定來源：zip 條目時間戳（17:05，晚於 `modifiedAt` 17:00，應是匯出時間）；縮圖的 `hash`／`id` 為隨機 uuid（`objects/` 與 `thumbnails/`）；`tokens.json` 的 set 與 theme 內部鍵序是雜湊序；theme id 在匯入來源 JSON 後被重新產生（來源是 `suite-x-mode-vibrant-light` 這種可讀 id，匯出是 uuid）；檔案層有 `revn`、`modifiedAt`。因此推測同內容兩次匯出的位元組會不同；若要進版控，需要規格化（略過縮圖與時間、正規化鍵序）的文字展開，不能直接比對 zip。這是推測，不是量測。

### 正規化文字 dump（ISSUE-023，PR-FILE-32）

```sh
node scripts/design/penpot-dump.mjs <匯出檔.penpot> [--out <dump>]          # 產生，預設寫在匯出檔旁（.dump.json）
node scripts/design/penpot-dump.mjs <匯出檔.penpot> --check [--out <dump>]  # 比對已提交的 dump，不一致結束碼 1 並以 - / + 列出差異行
node --test scripts/design/*.test.mjs
```

dump 是 JSON（鍵遞迴排序、2 格縮排、每欄位一行）。不輸出：所有 id（形狀、頁面、檔案、媒體、theme）、`revn`、`vern`、`modifiedAt`、`createdAt`、`hash`、`teamId`、`migrations`、`generatedBy`、`features`、縮圖與 `objects/`、可由位置與大小推得的 `selrect`、`points`、`transform`。順序有意義的清單保留來源順序：頁面根與各形狀的 `shapes`、`tokenSetOrder`。實測：同一份試點檔連續兩次產生，位元組相同（56,797 bytes、1,725 行，不含任何 uuid）。**沒有量測**：同內容兩次匯出的 zip 是否真的位元組不同，仍只有一次匯出；測試以人工改動時間戳、uuid、條目與鍵序的 zip 模擬重新匯出。元件的匯出表示未驗證，dump 對元件相關欄位照原樣輸出。

### 把母版轉成元件對匯出表示的影響

未做。重匯無法進行（`File.export` 失敗，見上），而在暫存檔轉換後不能匯出就看不到差異，也不為此改動暫存檔。階段二若母版要成為元件，解析規則（是否出現在 `components`、`componentId`／`mainInstance` 欄位、主元件所在位置）要在實際有元件的匯出檔上重驗。

### PR-FILE-23 判定

通過：腳本能離線列出母版名稱與數量，結果與 Penpot 內一致。限制如上：母版是板、元件表示未驗證、匯出檔不可決定性。

## Penpot 試點結論（ISSUE-022，PR-FILE-24）

2026-10-30。使用者在試點收尾時回覆「確認」，同意記錄結論；「確認」沒有指定下列兩項待決的選項，所以它們帶進階段二，不當成已決定。

| 承諾 | 結果 | 依據 |
| --- | --- | --- |
| PR-FILE-20 | 通過 | 三個母版在 Suite x Mode 四種 × Device 三種共 12 組，解析值與 `variables.json` 全等；見「母版與 theme 切換」章節。限制：載入圖片是純色替身，母版是板不是元件，`font-zh` 要以不帶屬性的 `applyToken` 綁成 `fontFamily` |
| PR-FILE-21 | retired | 使用者決定不做長時間編輯的壓力測試（2026-10-30） |
| PR-FILE-22 | retired | 隨 PR-FILE-21 不做 |
| PR-FILE-23 | 通過 | 腳本離線列出 3 個母版，與 Penpot 內一致；見「離線解析匯出檔」章節。限制：元件表示未驗證，匯出檔位元組不可決定 |

**沒有驗證的事：Penpot 是否比 OpenPencil 穩定。** 這是 ADR 0008 的立論原因（記憶體累積後當機），試點只證明 theme 切換正確與匯出檔可離線解析。切換後若在 Penpot 遇到同樣的當機，要重新評估。

**帶進階段二的待決項**

- 陰影「關閉」在 Penpot 沒有對應，只能用零偏移、零模糊、透明度 0 的陰影代替；使用者於 2026-10-30 接受（PR-FILE-33）。
- 匯出檔是二進位 zip，不適合單獨審查；使用者於 2026-10-30 決定另提交一份正規化文字 dump（PR-FILE-32），ADR 0008 已修訂。
- 使用端匯入強調色的做法（`import-accent.js` 沒有 Penpot 等價路徑）。
- 母版轉成元件後匯出表示是否改變，需先能重新匯出（外掛 `File.export` 現在失敗）。

**階段二要切的票（尚未寫檔，兩項已決定，可用 `/to-tickets` 切，並含 PR-FILE-32、33）**

- 重建其餘 20 個母版（含 `C/Select/Open`），依大小分 2 至 3 張（PR-FILE-18、26）。
- 離線驗證腳本：把 `scripts/penpot-pilot/parse-export.mjs` 正式化（ISSUE-023 已搬到 `scripts/design/`），加其他 theme 的解析值比對（PR-FILE-27）。
- 刪除 OpenPencil 產物並改文件：`.fig`、`scripts/design/` 的腳本與測試、`fig-variables.spec.ts`、consumer-guide、adoption-prompt、GLOSSARY，ADR 0008 改 Accepted（PR-FILE-28、07、08、30、31、09、06）。
- Penpot 自架說明文件（PR-FILE-29）。
- 使用端強調色匯入（PR-FILE-19），做法待決。
