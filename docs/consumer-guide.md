# 使用端接入

讓其他專案的代理執行完整接入，可使用[跨專案套用提示詞](adoption-prompt.md)。本文件提供具體安裝與 API 細節。

本文件對應[架構 §3.1、§3.3–3.4](03_architecture_design.md)、[前端 §5.1、§5.4–5.5](05_frontend_spec.md)。完整最小範例在 [examples/consumer](../examples/consumer/src/main.tsx)，只引用公開輸出。

## 建置、封裝與安裝

需要 Node.js 22.12 以上與 npm 11。先於此 repo：

```sh
npm ci
npm run build
npm pack ./packages/tokens --pack-destination .
npm pack ./packages/react --pack-destination .
```

把兩份 `.tgz` 移到使用端可存取位置。在獨立 React 專案執行（路徑依環境替換）：

```sh
npm install /path/to/luca-style-tokens-0.2.0.tgz /path/to/luca-style-react-0.2.0.tgz react@^19 react-dom@^19
```

兩個套件版本須一致；React 為 peer dependency。沒有公開 npm 發布要求。不可引用 `packages/*/src`；`dist` 是產物，不提交手改。

使用 Vite + TypeScript 時可複製 `examples/consumer` 到 repo 外，執行上述安裝、`npm install`、`npm run build`。範例的 `vite/client` 型別支援 CSS 和 `?url` 授權資產。其他 bundler 須提供對等 CSS、JSON、字體及文字資產載入。

```tsx
import '@luca-style/tokens/css';
import '@luca-style/react/fonts.css';
import '@luca-style/react/css';
import {ThemeProvider, Button, useTheme} from '@luca-style/react';
import themes from '@luca-style/tokens/data';
import typography from '@luca-style/tokens/typography';
```

公開 React 輸出亦含 TextField、Select、Checkbox、StatusMessage、ContentState、Navigation、MetricCard、DataTable 及相關型別；介面範例見 `/components`。`Navigation` 的品牌連結以可選屬性 `brandHref`（字串，預設 `/`）指定；部署在子路徑（例如 GitHub Pages 的 `/luca-style/`）時傳入 `brandHref="/luca-style/"`，未傳則維持 `/`，既有使用端不需修改。JSON 公開資料分別為套系／模式變數和響應式文字角色。

## 專案主題、密度與模式

專案入口包 `ThemeProvider suite="professional"`，或選 `vibrant`。活動、社群等親和型產品適合精緻活力；金融、資料監控等高密度產品適合精緻專業。範例的 suite 選單供比較，正式專案選定一套；不要求立即改寫既有專案。

Provider 下透過 `useTheme()` 取得 `mode`、`resolvedMode`、`setMode`。呼叫 `setMode('light' | 'dark' | 'system')` 切換；首次跟隨系統、手動選擇記於目前 origin 的 localStorage（鍵 `luca-style-mode`），system 移除偏好。Provider 不接收 mode prop，控制必須在 Provider 內。

- `persist={false}`：完全不讀寫 localStorage，選擇只留在本次頁面。
- `target="document"`：主題屬性與強調色變數套在 `<html>`，整頁底色跟著明暗變化；卸載時移除。
- 防閃爍：把 `themeInitScript({suite})` 的回傳字串放進 `<head>` 的行內 `<script>`（例如 Vite 的 `transformIndexHtml`，參考 `apps/showcase/vite.config.ts`），React 掛載前就依已存偏好設定 `<html>`。`suite` 要與 `ThemeProvider` 相同，未傳為 `vibrant`；不一致時掛載瞬間會換一次套系。首屏腳本會讀 localStorage，不要與 `persist={false}` 一起用；它要搭配 `target="document"`，否則 `<html>` 上的屬性停在首屏值，不隨後續切換更新。

`accent={{light, dark?, secondary?, soft?:{light?, dark?}}}` 覆寫專案強調色（`AccentInput`）；只有日間主色 `light` 必填。暗黑主色、柔和底色沒給時由 ThemeProvider 推算（同色相，通過文字對比 4.5:1）；點綴色沒給時沿用該模式的主色，有給則兩種模式都用同一值。滑過 `--accent-hover`、按下 `--accent-pressed` 與焦點框外圈 `--focus-ring` 一律由主色推算（OKLCH 明度位移，色相不變）。推算函式 `deriveAccent` 由 `@luca-style/tokens/accent` 匯出，建置與設計檔匯入用的是同一份。有給的顏色原樣使用、不做對比檢查：主按鈕文字在日間固定為白色，太淺的日間主色會讓按鈕文字看不清，請自行確認對比。Showcase 日間覆寫使用暖銅色與淺暖底，暗黑使用亮珊瑚色與深暖底。覆寫不改 success／warning／error。業務資料另定 `--data-positive` 等專案變數，使用文字、符號或圖例；不要引用 `--success`／`--error` 代表漲跌。

`density`（`compact`／`standard`／`comfortable`）與 `shape`（`sharp`／`rounded`）可單獨覆寫風格套系的預設等級，例如 `<ThemeProvider suite="professional" shape="rounded">`；沒給時沿用套系預設（精緻活力：標準、圓潤；精緻專業：標準、俐落），密度與外形與 0.1.0 相同。密度只改 `--control-height`、`--card-padding`、`--gap-section`、`--table-cell-padding-block`／`-inline`；外形只改 `--radius-card`、`--radius-control`、`--border-width`、`--metric-border-left`、`--metric-background`、`--metric-shadow`；兩者都不改色彩。數值見[前端 §5.4.1、§5.4.2](05_frontend_spec.md)。ThemeProvider 以 `data-density`、`data-shape` 屬性套用，與其他主題屬性在同一元素。`themeInitScript` 不處理這兩軸：`target="document"` 搭配覆寫時，React 掛載前會先以套系預設的間距與圓角排版，掛載後才換成覆寫值（色彩不受影響）；介意這一下跳動時，可在 `<head>` 首屏腳本之後自行加上 `document.documentElement.setAttribute('data-density','compact')` 等同值屬性。

整頁之外，特定頁面也可用 CSS 在自身區域覆寫密度變數，例如 `.dense-section { --card-padding:var(--space-4); --gap-section:var(--space-4); }`；不改文字角色或全域套系。自行版面使用 `--space-*`，欄位設定 `min-width:0`，窄版堆疊，表格保留可聚焦的水平捲動區。

響應式字級與斷點以[前端 §5.1](05_frontend_spec.md)為準。使用 `--type-title-size`／`--type-title-weight`／`--type-title-line-height` 等角色，正文同理使用 body。CSS 已處理三種裝置字級；頁面欄數與換行由使用端配置。減少動態規則隨 React CSS 交付。

## 字體與授權

`@luca-style/react/fonts.css` 自行託管 Inter、Noto Sans TC、IBM Plex Mono；字體與原始 OFL 一起封裝。來源版本見 [fonts README](../packages/react/fonts/README.md)。商用與再散布仍須保留對應 OFL，遵守其條件。

Vite 可將公開授權輸出當 URL：`import licenseUrl from '@luca-style/react/licenses/inter?url'`；另有 `notosanstc`、`ibmplexmono`。部署時保留建置產物中的字體與授權資產；不要只複製 CSS。

## Penpot 設計稿與程式同步

設計稿是一個以 Penpot 編輯的元件庫設計檔：`docs/mockup/luca-style-library.penpot`（Penpot 匯出檔，含設計變數與 23 個母版；審查用的文字 dump 是同目錄的 `luca-style-library.dump.json`，不能匯回 Penpot）。兩套風格與明暗以 token theme `Suite x Mode` 的四種組合切換（`Vibrant / Light`、`Vibrant / Dark`、`Professional / Light`、`Professional / Dark`），裝置以 theme `Device` 切換。畫面命名與狀態見[前端 §5.3、§5.5](05_frontend_spec.md)。自架 Penpot 的版本與啟動步驟見[Penpot 自架說明](penpot-self-hosting.md)。

| 設計稿名稱 | 程式公開對應 |
| --- | --- |
| suite／mode | Provider suite、useTheme mode |
| accent、success、radius-card 等角色 | 同名 CSS custom property（加 `--`）；公開 data JSON 同名 key |
| fs-hero、fs-title、fs-section 等 | typography JSON 的 hero、title、section；CSS `--type-<role>-size` |
| C/Button/*、C/Field/* | Button、TextField，props 與互動偽類 |
| C/Select、C/Checkbox、C/Status/*、C/State/* | Select、Checkbox、StatusMessage、ContentState |
| C/Card/Metric、C/Table、C/Nav/* | MetricCard、DataTable、Navigation |

人工同步順序：先核對正式前端規格與核可變更，修改結構化 tokens 來源並 `npm run generate`；在 Penpot 內同步相同角色與母版（母版只有一份，本 repo 以 `npm run check:penpot` 核對母版名稱齊全、已綁定，且各 `Suite x Mode` 與 `Device` 組合的解析值等於 `variables.json`）；重建樣張，檢查雙套系日夜、三裝置及四態，核對字級、間距、狀態與換行；同一變更提交程式、規格與元件庫設計檔。元件命名對應不是自動同步或像素保證。

### 更新元件庫設計檔（維護 luca-style 的人）

1. 在 Penpot 內改母版，並確認檔名是 `luca-style-library`。
2. 匯出，覆蓋 `docs/mockup/luca-style-library.penpot`。
3. 執行 `node scripts/design/penpot-dump.mjs docs/mockup/luca-style-library.penpot`，重新產生 `docs/mockup/luca-style-library.dump.json`。
4. 執行 `npm run check:penpot`。
5. 兩個檔案一起提交。匯出檔是二進位（約 353 KB），審查看 dump 的差異。

設計變數的值不在 Penpot 內改：改 `packages/tokens/src` 的 DTCG 原始檔，`npm run generate` 後把 `docs/mockup/themes/penpot-tokens.json` 重新匯入 Penpot 的 Tokens 面板，再依上列步驟匯出。

## 複製元件庫設計檔並匯入專案強調色

使用端的設計稿從元件庫設計檔複製開始（ADR 0007、0008）：檔案含設計變數與 23 個母版，沒有頁面 frame；頁面範本以樣張網站為準。

**未驗證提醒：** 強調色「產生 token JSON、在 Penpot 手動匯入」這個管道是建議做法，使用者尚未確認；「在 Penpot 介面實際匯入該 JSON」也未驗證（Penpot 的外掛 API 沒有匯入 JSON 的入口，只以 API 建立同樣的 set 與 token 模擬過）。下列步驟請在第一次使用時實測，與實際行為不符之處回報修正。

前提：需要一份 luca-style 檢出，並先在檢出內執行 `npm ci` 與 `npm run generate`（產生腳本從 `packages/tokens/dist/tokens.json` 取各套系的中性色）。腳本與設計檔都不在 npm 套件內，不能只靠安裝 `@luca-style/react`。

### 第一次：複製並匯入強調色

1. 把檢出內的 `docs/mockup/luca-style-library.penpot` 匯入自己的 Penpot（Penpot 的匯入檔案功能），之後在這份複本上畫稿，不要改 luca-style 的原檔。
2. 在 luca-style 檢出內產生強調色 token JSON。`--accent` 與 `ThemeProvider` 的 `accent` 屬性是同一種 `AccentInput`（只有 `light` 必填）：

```sh
node scripts/design/penpot-accent.mjs --accent '{"light":"#B5179E"}' --out accent.tokens.json
```

腳本呼叫與 `ThemeProvider` 同一份 `deriveAccent`，輸出增量檔：4 個新 set `Project Accent/{Vibrant,Professional}-{Light,Dark}`，各含 `accent`、`secondary`（點綴色）、`accent-soft`、`accent-hover`、`accent-pressed`、`focus-ring` 六個 token，以及 4 個 `Suite x Mode` theme（含 Base、既有 `Suite x Mode` set 與對應的 Project Accent set）。成功、警告、錯誤色與其他變數不動（ADR 0002）。
3. 在 Penpot 的 Tokens 面板匯入 `accent.tokens.json`，會多出 4 個 `Project Accent/*` set 與 4 個 `Suite x Mode` theme。匯入後切換一次 theme，讓畫面套用新色（實測以 API 重建 set 時，已啟用的 theme 要切走再切回才更新）。

匯入後母版畫面應顯示這組強調色（主要按鈕、滑過、焦點框、Select 選單等）。`accent-pressed` 沒有對應的按下狀態母版，只存在於變數；畫稿需要按下色時綁這個變數。

未驗證與備案：

- 匯入是合併還是取代整個 token 庫，未驗證。若匯入取代了整個庫，改為手動建立 4 個 set，貼入 6 個 token，並在 4 個 `Suite x Mode` theme 各啟用對應的 `Project Accent/*` set。
- set 的排序要在 `Suite x Mode` 各 set 之後（同名 token 後者覆蓋前者）；匯入後 Penpot 實際把它們排在哪裡未驗證，請確認，必要時手動調整順序。
- 還原強調色：在 4 個 theme 取消啟用並刪除 4 個 `Project Accent/*` set。

### luca-style 更新後：重新匯入設計變數

複本裡的母版與變數不會自動更新。luca-style 有新版（設計變數或母版變動）時：

1. 更新 luca-style 檢出並重新 `npm run generate`。
2. 只是設計變數變了：把檢出內 `docs/mockup/themes/penpot-tokens.json` 重新匯入複本的 Tokens 面板（匯入是否覆蓋既有 token 未驗證，先備份複本）；之後專案強調色要再產生一次 `accent.tokens.json` 並依上列步驟匯入。
3. 母版也變了：把新版 `luca-style-library.penpot` 重新匯入成新檔再重做強調色匯入；舊複本上的畫稿需要時自行比對新母版調整。
4. 只是專案換了主色：還原強調色後，用新的 `--accent` 重新產生並匯入。

沒有把新版母版合併進舊設計稿的腳本。

## 內容載入動畫

`ContentState state="loading"` 會隨 `ThemeProvider` 的套系與明暗模式顯示專屬載入 GIF（活力：潮汐波紋；專業：方序循環）。載入套件 CSS 即可；GIF 與減少動態使用的靜態 PNG 位於套件 `loading/`，由建置工具解析 CSS 相對路徑，不需複製到網站 public。動畫顯示 72px，保留文字與 `aria-busy`；離開 loading 狀態後移除。

## 獨立消費端驗證

```sh
npx playwright install chromium
npm run build
npm run test:consumer
```

驗證會封裝 tarball，在作業系統暫存目錄建立獨立專案、從 registry 安裝工具依賴、型別檢查、production build，於獨立 4174 port 啟動預覽，再以 Chromium 操作主題與元件並取得字體／授權。完成後關閉瀏覽器與伺服器並清除其暫存目錄。需網路及可用 4174 port；不發布 npm，不使用 workspace alias。

## 0.2.0 升級說明

從 0.1.0 升級時，依〈建置、封裝與安裝〉重新封裝並安裝兩個 0.2.0 tarball（兩個套件版本須一致）。`@luca-style/react` 新增執行期依賴 `@base-ui/react` ^1.9，隨 tarball 一起安裝；`react-dom` 19 列為 peer。沒給 `accent`、沒覆寫 `density`／`shape` 的專案，密度與外形與 0.1.0 相同；中性色 8 個角色改為冷藍灰（見〈中性色改為冷藍灰〉），所有元件的焦點框改為雙圈、主按鈕滑過改用推算色（見〈專案強調色〉），Checkbox 的方框改為依主題自繪、不再用瀏覽器的 `accent-color`（見〈其餘共用元件改用 Base UI〉）。

摘要：

- **必改**：有傳 `accent` 的專案改成 `AccentInput`（舊寫法會造成型別錯誤）；傳給 `Select` 的 `multiple`、`size` 或陣列值要拿掉。
- **可刪**：手寫的首屏防閃爍腳本、把 `resolvedMode` 同步到 `<html>` 的 effect、只為整頁底色加的 `html` 背景規則（見〈整頁主題與防閃爍〉）。
- **中性色**：頁面底色、卡片表面、次要表面、文字與邊框改為冷藍灰；寫死 0.1.0 色碼的地方改用設計變數（見〈中性色改為冷藍灰〉）。
- **可能要調整的測試**：見〈要調整的測試〉；最常見的是 Select 不再是原生 `<select>`，`selectOption()` 不能用。
- **不相容處**：Select、Checkbox、Navigation 的 DOM 與事件物件改變，逐條列在各元件小節。
- **設計稿**：0.1.0 的舊設計檔（依套系拆開的版本）已移除，設計稿起點改為 Penpot 版元件庫設計檔，見〈複製元件庫設計檔並匯入專案強調色〉。

### 要調整的測試

| 0.1.0 的寫法 | 0.2.0 的寫法 | 原因 |
| --- | --- | --- |
| `getByLabel('…').selectOption('dark')` | `getByLabel('…').click()` 後 `getByRole('option', {name:'暗黑'}).click()` | Select 改為自訂選單 |
| Select 上的 `toHaveValue('dark')` | `toHaveText('暗黑')`（比對顯示文字） | 欄位是 `<button>`，沒有 `value` |
| `select`、`document.querySelectorAll('select')` | `.luca-select-trigger` 或 `getByRole('combobox')` | 同上 |
| Checkbox 的 `getByLabel('…')` | `getByRole('checkbox', {name:'…'})` | `getByLabel` 會同時找到方框與隱藏的 input，strict mode 報錯 |
| `input[type=checkbox]`、`.luca-checkbox input` | `[role=checkbox]` 或 `.luca-checkbox-box` | 可見的方框改為 `<span>` |
| 斷言按鈕滑過的 `filter: brightness(...)` | 斷言背景色等於 `--accent-hover` | 滑過改用推算色 |
| 斷言焦點框為 3px 文字色單圈 | 2px 卡片表面色內圈＋2px `--focus-ring` 外圈 | 焦點框改為雙圈 |
| `.luca-navigation > div` | `.luca-navigation-list` | 連結列改為 `<ul>`／`<li>` |
| 依賴主題外層 `div` 結構（`target="document"` 時） | 主題容器 `[data-luca-theme]` 是 `<html>` | 主題套在整頁 |
| 斷言頁面底色、文字或邊框等於 0.1.0 色碼（例如 `#F7F7F2`） | 斷言等於對應的設計變數，或改用〈中性色改為冷藍灰〉的新值；截圖基準要重新產生 | 中性色改值 |

### 中性色改為冷藍灰

中性色 8 個角色改為一致的冷藍灰（決策見 decision-log 2026-10-29）。兩個風格套系共用同一組值，只隨明暗模式變化；`ThemeProvider` 沒有覆寫中性色的選項。

| 角色 | 日間 0.1.0 | 日間 0.2.0 | 暗黑 0.1.0 | 暗黑 0.2.0 |
| --- | --- | --- | --- | --- |
| `bg` | `#F7F7F2` | `#F7F8FA` | `#151A18` | `#111317` |
| `surface` | `#FFFFFF` | `#FFFFFF` | `#1D2420` | `#1A1D22` |
| `surface-subtle` | `#F1F3EE` | `#F1F3F5` | `#252E28` | `#23272D` |
| `text` | `#24312A` | `#2C2E31` | `#EDF3ED` | `#EFF1F5` |
| `muted` | `#626F65` | `#696B6F` | `#A5B5A8` | `#AEB0B4` |
| `border` | `#DDE5DC` | `#E0E2E6` | `#354139` | `#3C3E41` |
| `control-border` | `#7B8C80` | `#85878B` | `#65766B` | `#6F7175` |
| `accent-ink` | `#FFFFFF` | `#FFFFFF` | `#151A18` | `#111317` |

使用端的 CSS、行內樣式或圖片若寫死上表的 0.1.0 色碼，改成對應的設計變數（例如 `var(--bg)`、`var(--surface)`、`var(--text)`、`var(--border)`），之後 luca-style 再改值時就會自動跟上。只有使用設計變數的專案不需修改。

### 整頁主題與防閃爍

使用端可刪掉的自補程式：

- 在 `<head>` 手寫的首屏腳本：讀 `luca-style-mode`、跟隨 `prefers-color-scheme`、設定 `document.documentElement.dataset.mode`。改放 `themeInitScript({suite})` 的回傳字串。
- 把 `resolvedMode` 同步到 `<html>` 的 `useLayoutEffect`／`useEffect`（例如 `document.documentElement.dataset.mode = resolvedMode`）。改用 `<ThemeProvider target="document">`。
- 只為了讓整頁底色跟上主題而加的 `html { background:... }` 規則：`target="document"` 後 `<html>` 本身帶主題屬性，套件 CSS 會給它底色。若希望外部 CSS 到達前也有正確底色，可保留以 `html[data-mode="dark"]` 為條件的行內保底樣式。

注意事項：

- `suite="professional"` 的專案要把同一個套系傳給 `themeInitScript({suite:'professional'})`；沒傳時腳本以 `vibrant` 設定，React 掛載瞬間會閃一下套系。
- `persist={false}` 時不要放首屏腳本：腳本會讀 localStorage，與「不讀寫儲存」矛盾，屬於誤用。
- 偏好鍵名仍是 `luca-style-mode`，值仍為 `light`／`dark` 純字串；0.1.0 存下的選擇不需遷移。
- `target="document"` 後頁面上符合 `[data-luca-theme]` 的元素是 `<html>`，不再有外層 `div`；以該選擇器找主題容器的測試仍可用，但依賴外層 `div` 結構的 CSS 或測試要調整。

### 資訊密度與元件外形可單獨覆寫

- 沒給 `density`、`shape` 時密度與外形與 0.1.0 相同，不需修改。
- 新增 CSS 變數 `--table-cell-padding-block`、`--table-cell-padding-inline`（預設 12px／8px，即 0.1.0 表格儲存格內距），也寫進設計檔變數。
- `--control-height` 改由密度等級提供，精緻專業 comfortable 為 52px；直接在頁面覆寫這些變數的寫法仍有效。

### 專案強調色改為 `AccentInput`

舊的兩種寫法已移除，傳入會造成型別錯誤。新舊對照：

| 0.1.0 | 0.2.0 |
| --- | --- |
| `{primary, secondary, soft, ink}` | `{light: primary, secondary, soft: {light: soft}}`；`ink` 移除 |
| `{light: {primary, secondary, soft, ink}, dark: {primary, secondary, soft, ink}}` | `{light: light.primary, dark: dark.primary, secondary: light.secondary, soft: {light: light.soft, dark: dark.soft}}`；`dark.secondary`、兩個 `ink` 移除 |

注意事項：

- 顏色須為 `#RRGGBB`，其他寫法（`red`、`#abc`）會讓推算在 render 時拋錯。
- 點綴色只有一個值，兩種模式共用；0.1.0 的暗黑專屬點綴色無法表達（樣張原本的暗黑點綴 `#E6BE70` 因此不再使用）。沒給時沿用該模式的主色。
- `accent-ink`（填色按鈕上的文字）不再可覆寫，固定為日間白色、暗黑 `#111317`。有給的顏色原樣使用、不做對比檢查；日間主色很淺（例如亮黃）時白字對比會不足，請改用較深的主色。
- 推算的只有沒給的角色：暗黑主色、柔和底色、點綴色，以及一律推算的滑過、按下、焦點框色。推算值都通過文字對比 4.5:1（焦點框 3:1）；位移後不足時會再加深／加亮。
- 按鈕滑過不再用 `filter:brightness(.94)`，改為 `--accent-hover`；測試若斷言 `filter` 或焦點框粗細（舊為 3px 文字色單圈，現為 2px 卡片表面色內圈＋2px 主色外圈）需調整。
- 新增的 CSS 變數：`--accent-hover`、`--accent-pressed`、`--focus-ring`；套系預設值在建置時算好，也寫進設計檔變數。

### Select 改為自訂選單

`Select` 改由 Base UI 的 Select 實作，選單外觀跟著風格套系、明暗模式與元件外形。`@luca-style/react` 新增依賴 `@base-ui/react` ^1.9，`react-dom` 19 列為 peer。

DOM 改變：欄位是 `role="combobox"` 的 `<button>`（仍帶 `.luca-input`，另加 `.luca-select-trigger`），選單是 `role="listbox"`，選項是 `role="option"`。選單 portal 到 `ThemeProvider` 的外層容器；`target="document"` 時 portal 到 `<body>`。沒有 `ThemeProvider` 時也 portal 到 `<body>`，這時選單拿不到主題變數。

端對端測試的改法：`selectOption()` 只能操作原生 select，對 `Select` 會報「Element is not a `<select>` element」。改為點欄位、再以顯示文字點選項：

```ts
// 0.1.0
await page.getByLabel('明暗模式').selectOption('dark');
// 0.2.0
await page.getByLabel('明暗模式').click();
await page.getByRole('option', {name:'暗黑'}).click();
```

- 選項以顯示文字找，不是 `value`。
- 欄位沒有 `value` 屬性，`toHaveValue()` 改用 `toHaveText()` 比對欄位顯示的選項文字。表單送出的值仍在 `FormData` 裡（有給 `name` 時）。
- 鍵盤操作：Enter、Space 或方向鍵開啟；方向鍵移動；Enter 選取並關閉；Esc 關閉不變更；關閉後焦點回到欄位。

仍可用的 props：`label`、`helper`、`error`、`id`、`className`、`value`、`defaultValue`、`onChange`（`event.target.value` 仍為字串）、`name`、`disabled`、`required`、`form`、`autoComplete`、`aria-*`，以及以 `<option>` 子元素描述選項（`value`、`label`、`disabled` 與文字；沒給 `value` 時以文字當值）。沒給 `value`、`defaultValue` 時與原生相同，選第一個可選項。

不相容處：

- `multiple`、`size` 移除，傳入會造成型別錯誤。
- `value`、`defaultValue` 只接受單一字串或數字；傳陣列會造成型別錯誤。
- `onChange` 收到的不是瀏覽器原生的 change 事件，只有 `type: 'change'` 與 `target`／`currentTarget` 上的 `value`、`name`、`id`。`preventDefault()`、`nativeEvent`、`target.selectedOptions` 等都不存在。
- 其他屬性（`title`、`data-*`、`onFocus`、`onBlur`、`onKeyDown` 等）套在欄位的 `<button>` 上；型別仍宣告為 `HTMLSelectElement` 的事件，但執行時的 `currentTarget` 是 button。
- 子元素只讀 `<option>`（包在 Fragment 裡也可以）；`<optgroup>` 和其他元素會被略過，群組內的選項也不會出現。
- 停用的選項在選單中顯示為「名稱（不可選）」，可以用方向鍵移到它，但無法選取。
- 以 `select` 標籤選擇器寫的 CSS 或 DOM 查詢（例如 `document.querySelectorAll('select')`）不再找得到 `Select`；改用 `.luca-select-trigger`。
- Vite 建置時，Base UI 檔案開頭的 `'use client'` 會產生「module level directive may not be preserved」警告，不影響輸出，可以忽略。

### 其餘共用元件改用 Base UI

`Button`、`TextField`、`Checkbox`、`Navigation` 也由 Base UI 處理互動、鍵盤與焦點，所有元件的焦點樣式都是上述雙圈。`MetricCard`、`StatusMessage`、`ContentState`、`DataTable` 沒有對應的 Base UI 元件，維持原樣；`ContentState` 的重試按鈕就是新的 `Button`。公開 props 與 class 名稱（`.luca-button`、`.luca-input`、`.luca-brand` 等）都保留。

`Button`、`TextField` 完全相容：仍是原生 `<button>`、`<input>`，事件、`ref` 與其他屬性照舊。`Button` 的 `disabled`、`loading` 仍使停用、不可聚焦。

`Checkbox` 不相容處：

- DOM 改變：可見的方框是 `role="checkbox"` 的 `<span class="luca-checkbox-box">`，旁邊另有 `aria-hidden` 的隱藏 `<input type="checkbox">` 負責表單送出（有給 `name` 時仍會進入 `FormData`，沒給 `value` 時為 `on`；停用時不送出，與原生相同）。`input[type=checkbox]`、`.luca-checkbox input` 的選擇器或 CSS 不再命中可見的方框；改用 `[role=checkbox]` 或 `.luca-checkbox-box`。
- `getByLabel('…')` 會同時找到方框與隱藏的 input（兩個元素，Playwright 的 strict mode 會報錯）。端對端測試改為 `getByRole('checkbox', {name:'…'})`，`check()`、`uncheck()`、`toBeChecked()`、`toBeDisabled()` 都照常可用。
- `onChange` 收到的不是瀏覽器原生的 change 事件，只有 `type: 'change'` 與 `target`／`currentTarget` 上的 `checked`、`value`（沒給 `value` 時為 `on`）、`name`、`id`。`preventDefault()`、`nativeEvent` 等都不存在。
- 其他屬性（`className`、`title`、`data-*`、`aria-*`、`onFocus`、`onBlur`、`onKeyDown` 等）套在方框上，不是 `<input>`；型別仍宣告為 `HTMLInputElement` 的事件，但執行時的 `currentTarget` 是方框。`className` 因此加在方框上，不再是 input。
- 原生 `<input>` 專屬的屬性（例如 `autoFocus`、`tabIndex`）落在方框節點，不是隱藏的 input。
- 外觀：方框改為依主題自繪（邊界 `control-border`、勾選時填主色、打勾用 `accent-ink`），不再用瀏覽器的 `accent-color`。
- 在原生 `<fieldset disabled>` 內時，Base UI 的方框不會被瀏覽器自動停用；樣張的「儲存中」流程是自己傳 `disabled`。使用端若靠 fieldset 一次停用，請改為對每個 `Checkbox` 傳 `disabled`。
- 空白鍵切換，Enter 不切換也不會送出表單（原生核取方塊按 Enter 會送出所在表單）。

`Navigation` 不相容處：

- 連結列由 `<div>` 改為 `<ul class="luca-navigation-list">` 加 `<li>`；`.luca-navigation > div` 的 CSS 或查詢要改為 `.luca-navigation-list`。連結仍是 `<a>`，目前頁面仍有 `aria-current="page"`，`.luca-brand` 仍是 `<nav>` 下的第一個 `<a>`。
- 外層 `<nav>` 由 Base UI 的 NavigationMenu 渲染，會多帶 Base UI 自己的 `data-*` 屬性。

另外，Vite 建置時多出幾個 Base UI 檔案的 `'use client'` 警告，與 Select 相同，可以忽略。
