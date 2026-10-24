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

## 凍結承諾與證據

承諾全文、範圍、排除項目及決策已遷移至[設計系統需求承諾](capabilities/design-system.md#需求承諾)，共 PR-STYLE-01～24，無 retired 行。下列證據使用真實套件與瀏覽器，不以靜態 Pencil frame 代替 React 驗收。

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
| PR-STYLE-14 | 正式 tokens/react 套件、showcase 五頁、單一 components.pen、consumer-guide、examples/consumer；test:consumer 從 tarball 於 repo 外安裝、typecheck、build、瀏覽器操作。 |
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

## Pencil 與程式對照

以[前端 §5.1–5.5.4](05_frontend_spec.md)及[公開對應表](consumer-guide.md#pencil-與程式同步)核對同名色彩／字體角色、22 母版對應的正式元件、產品與介紹頁代表結構。先前實際 Pencil QA 已確認 22 母版、12 檢視板、240 唯一 frame；各頁三寬度與 15 個 fallback 樣本曾目視核對。雙套系分區為左側 Vibrant、右側 Professional。這些是既有設計證據，本輪沒有重新開啟 components.pen：MCP 當前開啟的是其他專案的設計檔，未讀取 .pen 的檔案系統內容，亦未修改其他設計檔。

實作保留設計角色與內容層次，以下差異由可操作網頁需要而來：

- Pencil 分立 240 個靜態 frame；React 使用單一頁面與本機「樣張狀態」選單，錯誤重試回復正常內容。
- Pencil 狀態母版獨立展示；React 以 props、原生 disabled、hover、focus-visible 與可關聯錯誤文字實際操作。
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

