# 切換主題和寬度，並定下桌機並排方式

Blocked by: ISSUE-002

## Done when

- 切換風格套系或明暗模式時，四格一起改變，其他頁面的主題設定不受影響。
- 切換桌機或手機寬度時，版面按該寬度的斷點呈現。
- `docs/05_frontend_spec.md` §5.3.7 的 Loading、Empty、Error 都做好；單一格無法呈現時，其他格和切換控制照常可用。
- 桌機並排方式由專案負責人看過實際畫面後決定，結果寫進 §5.3.7 和 `docs/decision-log.md`。

## Context

兌現 PR-REVIEW-03、04，規格見 `docs/issues/ISSUE-001-state-overview-page.md`。四格 1280px 放不進一個視窗，規格刻意沒有定下並排方式，要看到實際畫面才能判斷。這張票也是 ISSUE-001 記載的 Storybook 退路判斷點。

## Notes

- 版面斷點都是 `@media`，同一視窗內不會跟著改變，所以寬度要用 iframe 切換。
- 局部切換的範圍是單格。格子是 iframe 時，用該 iframe 文件上的 `target="document" persist={false}`；App 外層的 `target="document"` 仍不能用來切單格。
- 這次由代理無人值守執行，不能停下來問，也不能自己選。兩種版面都做成真實頁面，並準備縮小並排和原尺寸橫向捲動的截圖，留給專案負責人看過再選。縮小看得到全貌但字會失真，原尺寸字正確但看不到全貌。
- Storybook 退路同樣由專案負責人判斷：如果總覽頁外殼的工夫明顯超過頁面本身，代理就停下來回報，不要繼續做，也不要改用 Storybook。

### 議定的接縫（第二版，已審）

**做法。** 總覽頁外殼（`/dev/state-overview`）放切換控制和四格，每格一個 iframe，指向只在開發環境開放的 `/dev/state-overview/frame?screen=&state=&suite=&mode=`。

- 格內由網址參數決定狀態與主題（PR-REVIEW-05），用 `ThemeProvider target="document" persist={false}` 套在該 iframe 自己的文件上。格內網址在 `main.tsx` 不包外層 provider。
- 外殼的外觀不跟著切換：維持 `main.tsx` 現有的 provider，只讀偏好、不寫入。切換控制預設精緻活力、日間。
- 寬度只改 iframe 元素寬度，`@media` 直接重算，不重新載入；換套系或明暗則換網址並重新掛載 iframe，避免留下瀏覽歷史。
- 格內用 `postMessage` 回報 `ready` 或 `failed`，外殼依 `event.source` 比對是哪一格。`ready` 才顯示 iframe，之前顯示載入提示。高度以 `#root` 量測，再用 ResizeObserver 持續回報；`documentElement` 帶 `[data-luca-theme]` 的 `min-height:100vh`，量它會縮不回來。
- 檔案：外殼 `state-overview.tsx`，格內 `state-overview-frame.tsx`，畫面清單 `state-overview-screens.tsx`。外殼不再直接匯入 `Product`。

**公開邊界。** 開發伺服器（port 4178）上的兩個網址，測試只透過瀏覽器看得到的東西觀察：角色與標籤、iframe 內的屬性與計算樣式、`localStorage`。不匯出任何給測試用的函式，也不加「故意失敗」的參數；失敗和空清單用 Playwright 的 `page.route` 改寫模組或擋請求來製造。測試都放在 `tests/state-overview.spec.ts`。

| 接縫 | 透過它測什麼 | 抓得到 | 抓不到 |
| --- | --- | --- | --- |
| 切換風格套系（PR-REVIEW-03） | 四格的 `data-suite` 與主色都改變，對照 §5.4 色票 | 只改到部分格、屬性有寫但樣式沒生效 | 配色本身好不好看 |
| 切換明暗模式（PR-REVIEW-03） | 四格的 `data-mode`、`bg` 與主色都改變，對照 §5.4 色票。`bg` 兩個套系共用，所以不用來判斷套系 | 同上 | 同上 |
| 已存偏好不影響格內 | 已存暗黑時，`mode=light` 的格內網址顯示完成後仍是日間 | 首屏腳本的舊值留到顯示時 | `ready` 前的短暫狀態（iframe 此時隱藏） |
| 其他頁面不受影響（PR-REVIEW-03） | 兩個方向都驗，也都操作套系控制。已存 `dark`：先選暗黑再選日間（控制預設就是日間，直接選日間不會有變化），每一步之後值都仍是 `dark`，之後開 `/templates/product` 仍是暗黑與預設套系。沒有存值、切到暗黑：鍵仍不存在 | 偏好被寫入或清除 | 樣張網站的套系（本來就不保存） |
| 切換桌機、手機寬度（PR-REVIEW-04） | iframe 內 `innerWidth` 為 1280、390；`.product-layout` 的欄數四格都和 `/templates/product` 在同一視窗寬度下相同；`.product-metrics` 只在 Success 那格比對，因為只有它有這個區塊 | 斷點沒跟著 iframe 改變、只用縮放假裝寬度 | 斷點以外的細部差異（ISSUE-004 截圖負責） |
| 格子不被裁切 | 每次切換寬度後（1280→390→1280），在兩種版面下，每個 iframe 的框都不為零且在所屬格子內；iframe 內 `#root` 高度等於 `innerHeight`（容差 1px，多或少都算錯），文件沒有超出 iframe | 寬度不重新載入時留下舊高度、變長被切掉或變短留白 | 文字縮小後讀不讀得清楚（看截圖） |
| Loading（§5.3.7） | 兩道暫扣：扣住一格的文件時，該格顯示提示；放行文件但扣住 `state-overview-frame.tsx`，確認該格 `document.readyState` 已是 `complete`，提示仍在、iframe 仍隱藏。兩道都確認其他格已呈現、控制可用；全部放行後提示消失。換套系或明暗重新掛載時，同樣扣住模組，確認提示再次出現 | 把 iframe `load` 當成完成、整頁等最慢的一格、提示不消失 | 真實網路下的時間長短 |
| Empty（§5.3.7） | 用 `page.route` 把 `state-overview-screens.tsx` 換成空清單：顯示「此頁沒有可審的畫面」，沒有任何格子 | 空清單時崩潰或留下空白 | 多個畫面時的選擇（目前只有一個畫面，不做選單） |
| Error（§5.3.7） | 故障格選 Empty，避免和產品畫面自己的錯誤提示混淆；斷言失敗文案，不靠 `alert` 角色。兩條路：依請求的 frame 篩選，把該格的 `product.tsx` 換成 render 時丟例外的版本，並保留 `Product`、`ProductSamples` 兩個匯出（走錯誤邊界）；擋掉該格的文件（走逾時，用 `page.clock` 快轉）。兩條路都確認其他三格內容正常、切換控制對其他三格仍有效 | 一格壞掉拖垮整頁、完全載不起來時沒人回報 | 真實畫面會怎麼壞 |
| 並排方式參數（`?layout=scroll`、`fit`，**選擇待定**） | 兩種都要四格同列、不重疊。`scroll`：比例為 1、iframe 為實際寬度、容器可橫向捲動。`fit`：四格都在視窗內、容器不橫向捲動、比例小於 1。桌機、手機寬度都驗。不帶參數時等於 `scroll` | 其中一種壞掉 | 哪一種比較好，這由專案負責人決定 |
| 上一張票的既有檢查 | 改成穿過 iframe 查詢（見下） | 四格內容、與範本一致、不需後端、重試不改狀態 | 無新增 |
| PR-REVIEW-01 | `not-found.spec.ts`、`pages.spec.ts` 的 404 與輸出掃描多驗 `/dev/state-overview/frame` | 格內網址流進正式輸出 | 無新增 |

**不測。** 控制的擺放與外觀、載入提示的樣子、縮放比例的精確值和文字可讀性（截圖交給專案負責人判斷）、`postMessage` 訊息格式（內部細節）。截圖與 axe 矩陣屬於 ISSUE-004，兩個版面方向屬於 ISSUE-005，834 寬度不做控制項：§5.3.7 和本票只要桌機或手機，ISSUE-004 需要時可以直接開格內網址。

**會修改的既有測試**（`tests/state-overview.spec.ts`，內容移進 iframe）。

- 四格內容、與範本一致、重試：改用 `frameLocator`，斷言不變。
- 不見樣張選單：每格先確認 `.product-page` 可見，再確認格內沒有選單，外殼層的檢查也保留。否則空的 iframe 也會通過。
- 不需後端：在 `networkidle` 之前，先確認每格 `.product-page` 可見。
- imports 檢查：清單加入 `state-overview-frame.tsx`、`state-overview-screens.tsx`，兩者都留在 PR-REVIEW-06 的檢查內。
- 「總覽頁渲染真正的產品畫面」：來源檢查從 `state-overview.tsx` 移到 `state-overview-screens.tsx`，因為外殼不再匯入 `Product`。
- 並排測試：斷言不變，在預設的 `scroll` 下照舊要求同一高度、不重疊；`fit` 由版面那一列涵蓋。

**待負責人決定的事不會被默默定下。**

- 暫定預設是 `scroll`，因為它最接近上一張票「原尺寸、橫向捲動」的做法，不代表已經選定。它和舊 CSS 並不完全相同：舊版每格最小 360px 各自捲動，接縫要求每格裝得下整個 iframe，所以 CSS 必須改。程式註解寫明「暫定，尚未決定」。
- 切換方式只有 `?layout=` 網址參數，不加控制項，選定後刪掉一個分支和參數就好。
- 這張票的 diff 不碰 `docs/05_frontend_spec.md` §5.3.7 和 `docs/decision-log.md`。兩種版面都留到專案負責人選定。Done when 第四條維持未完成，票檔留著，不 `git rm`。
- 提交時在這裡加 `### 待負責人決定`：並排方式、Storybook 退路兩個待決問題，以及截圖路徑。截圖存在 `C:\Users\x1596\AppData\Local\Temp\claude\D--luca-style\acf83588-5d66-48b8-ae43-47ab2b6def13\scratchpad\issue-003\`，都是 1280 寬視窗：`fit` 全頁、`scroll` 全頁、`fit` 單格放大裁切各一張。專案負責人隨時可以在開發伺服器開 `/dev/state-overview?layout=fit` 或 `?layout=scroll` 看到實際畫面，不靠這些截圖。
- Storybook 退路記為待決，列出實際數字：所有新增內容（外殼、格內路由、畫面清單、CSS、`main.tsx` 和 `routes.ts` 的改動，不含測試）的行數與位元組，對照 `product.tsx` 加 `product-template.tsx`，再加上不順手之處。

**給審查者的揭露。**

1. `docs/decision-log.md` 2026-10-31 寫「風格套系與明暗用 ThemeProvider 局部切換」。這裡在 iframe 內用 `target="document"`，局部的範圍是該 iframe 的文件。外層 div 其實也有 `bg`、`min-height:100vh` 和 `color-scheme`（`packages/react/src/styles.css:6`、`packages/tokens/build.mjs:54`），真正的差別是 `<html>` 會留著首屏腳本寫的舊狀態，DOM 也和 `/templates/product` 不同。
2. `docs/consumer-guide.md:47` 說首屏腳本不要與 `persist={false}` 併用，但每份開發環境的 HTML 都會注入它（`apps/showcase/vite.config.ts:8`）。最後狀態正確，因為 `packages/react/src/theme.tsx:67` 會覆寫屬性；React 掛載前格內會呈現已存的模式，所以 `ready` 之前 iframe 保持隱藏。
3. `ThemeProvider` 沒有 `mode` prop，只能在子元件的 layout effect 呼叫 `useTheme().setMode`，並在繪製前重新渲染。不改公開元件，記為不順手之處，供 Storybook 判斷參考。

### 待負責人決定

這張票的 Done when 第四條還沒完成，所以票檔留著。切換、Loading、Empty、Error 都已提交，下面兩件事要專案負責人看過後決定。

**1. 桌機並排方式。** 兩種都能開：開發伺服器上的 `/dev/state-overview?layout=fit` 和 `?layout=scroll`。不帶參數時是 `scroll`，只是暫定。選定後刪掉另一個分支、`layout` 參數和 `useFitScale`，再把結果寫進 `docs/05_frontend_spec.md` §5.3.7 和 `docs/decision-log.md`。

| 方式 | 看得到 | 看不到 |
| --- | --- | --- |
| `fit`（縮小並排） | 四格全貌，比例約 0.23（1280 寬視窗） | 內文讀不清楚，字約 3 到 4px |
| `scroll`（原尺寸橫向捲動） | 字和版面都是實際大小 | 一個視窗只放得下一格，要捲動才能比對 |

截圖（1280 寬視窗）：

- `C:\Users\x1596\AppData\Local\Temp\claude\D--luca-style\acf83588-5d66-48b8-ae43-47ab2b6def13\scratchpad\issue-003\layout-a-fit-1280.png`
- `C:\Users\x1596\AppData\Local\Temp\claude\D--luca-style\acf83588-5d66-48b8-ae43-47ab2b6def13\scratchpad\issue-003\layout-b-scroll-1280.png`
- `C:\Users\x1596\AppData\Local\Temp\claude\D--luca-style\acf83588-5d66-48b8-ae43-47ab2b6def13\scratchpad\issue-003\layout-a-fit-success-zoom3x.png`（`fit` 的 Success 格，放大 3 倍且不插值）
- `C:\Users\x1596\AppData\Local\Temp\claude\D--luca-style\acf83588-5d66-48b8-ae43-47ab2b6def13\scratchpad\issue-003\layout-a-fit-success-actual-pixels.png`（同一格的實際像素）

**2. Storybook 退路。** 外殼在每個量法上都比畫面本身大：

| 程式 | 行數 | 位元組 |
| --- | --- | --- |
| 外殼：`state-overview.tsx` 71、`state-overview-frame.tsx` 46、`state-overview-screens.tsx` 8、`state-overview.css` 10，加 `main.tsx`、`routes.ts` 新增的 15 行 | 150 | 10,335 |
| 畫面：`product.tsx` 24、`product-template.tsx` 7 | 31 | 5,896 |
| 畫面加上 `styles.css` 裡它專用的 23 行樣式 | 54 | 8,027 |

- 外殼的數字含 ISSUE-002 已有的 17 行，也含選定後會刪掉的 `fit` 程式。不含測試：`tests/state-overview.spec.ts` 這張票多了約 300 行。
- 畫面這邊一行很長，看位元組比看行數公平；公開元件的程式都沒有算進去。
- 代理沒有因此停下：差距約 1.3 到 1.75 倍，新增畫面只要在清單加一項，而且一次就做通。這是否算「明顯超過」，由專案負責人判斷。

不順手的地方：

- `ThemeProvider` 沒有 `mode` prop，只能在子元件的 layout effect 呼叫 `setMode`。
- 開發環境每份 HTML 都有首屏腳本，`docs/consumer-guide.md` 說不要與 `persist={false}` 併用；所以 iframe 要等 `ready` 才顯示。
- 寬度要用 iframe，連帶需要回報高度、縮放比例和逾時，這些是外殼主要的程式量。
- 換套系或明暗時四格都要重新載入。
- `fit` 的比例取決於容器寬度，要固定保留頁面捲軸的位置，否則比例可能來回變動。
