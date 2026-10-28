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
npm install /path/to/luca-style-tokens-0.1.0.tgz /path/to/luca-style-react-0.1.0.tgz react@^19 react-dom@^19
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

`density`（`compact`／`standard`／`comfortable`）與 `shape`（`sharp`／`rounded`）可單獨覆寫風格套系的預設等級，例如 `<ThemeProvider suite="professional" shape="rounded">`；沒給時沿用套系預設（精緻活力：標準、圓潤；精緻專業：標準、俐落），畫面與 0.1.0 相同。密度只改 `--control-height`、`--card-padding`、`--gap-section`、`--table-cell-padding-block`／`-inline`；外形只改 `--radius-card`、`--radius-control`、`--border-width`、`--metric-border-left`、`--metric-background`、`--metric-shadow`；兩者都不改色彩。數值見[前端 §5.4.1、§5.4.2](05_frontend_spec.md)。ThemeProvider 以 `data-density`、`data-shape` 屬性套用，與其他主題屬性在同一元素。`themeInitScript` 不處理這兩軸：`target="document"` 搭配覆寫時，React 掛載前會先以套系預設的間距與圓角排版，掛載後才換成覆寫值（色彩不受影響）；介意這一下跳動時，可在 `<head>` 首屏腳本之後自行加上 `document.documentElement.setAttribute('data-density','compact')` 等同值屬性。

整頁之外，特定頁面也可用 CSS 在自身區域覆寫密度變數，例如 `.dense-section { --card-padding:var(--space-4); --gap-section:var(--space-4); }`；不改文字角色或全域套系。自行版面使用 `--space-*`，欄位設定 `min-width:0`，窄版堆疊，表格保留可聚焦的水平捲動區。

響應式字級與斷點以[前端 §5.1](05_frontend_spec.md)為準。使用 `--type-title-size`／`--type-title-weight`／`--type-title-line-height` 等角色，正文同理使用 body。CSS 已處理三種裝置字級；頁面欄數與換行由使用端配置。減少動態規則隨 React CSS 交付。

## 字體與授權

`@luca-style/react/fonts.css` 自行託管 Inter、Noto Sans TC、IBM Plex Mono；字體與原始 OFL 一起封裝。來源版本見 [fonts README](../packages/react/fonts/README.md)。商用與再散布仍須保留對應 OFL，遵守其條件。

Vite 可將公開授權輸出當 URL：`import licenseUrl from '@luca-style/react/licenses/inter?url'`；另有 `notosanstc`、`ibmplexmono`。部署時保留建置產物中的字體與授權資產；不要只複製 CSS。

## OpenPencil 與程式同步

設計稿是兩個以 OpenPencil 編輯的套系設計檔：`docs/mockup/components-vibrant.fig`（Vibrant／精緻活力）與 `docs/mockup/components-professional.fig`（Professional／精緻專業）。一個專案只選一套風格，因此只需開所選套系的那個檔案。畫面命名與狀態見[前端 §5.3、§5.5](05_frontend_spec.md)。

| 設計稿名稱 | 程式公開對應 |
| --- | --- |
| suite／mode | Provider suite、useTheme mode |
| accent、success、radius-card 等角色 | 同名 CSS custom property（加 `--`）；公開 data JSON 同名 key |
| fs-hero、fs-title、fs-section 等 | typography JSON 的 hero、title、section；CSS `--type-<role>-size` |
| C/Button/*、C/Field/* | Button、TextField，props 與互動偽類 |
| C/Select、C/Checkbox、C/Status/*、C/State/* | Select、Checkbox、StatusMessage、ContentState |
| C/Card/Metric、C/Table、C/Nav/* | MetricCard、DataTable、Navigation |

人工同步順序：先核對正式前端規格與核可變更，修改結構化 tokens 來源並 generate；以 OpenPencil 工具同步相同角色與母版（兩個套系設計檔各帶一份相同的母版，兩邊都要改，本 repo 以 `scripts/design/check-masters.js` 比對）；重建樣張，檢查雙套系日夜、三裝置及四態，核對字級、間距、狀態與換行；同一變更提交程式、規格與套系設計檔。元件命名對應不是自動同步或像素保證。

## 內容載入動畫

`ContentState state="loading"` 會隨 `ThemeProvider` 的套系與明暗模式顯示專屬載入 GIF（活力：潮汐波紋；專業：方序循環）。載入套件 CSS 即可；GIF 與減少動態使用的靜態 PNG 位於套件 `loading/`，由建置工具解析 CSS 相對路徑，不需複製到網站 public。動畫顯示 72px，保留文字與 `aria-busy`；離開 loading 狀態後移除。

## 獨立消費端驗證

```sh
npx playwright install chromium
npm run build
npm run test:consumer
```

驗證會封裝 tarball，在作業系統暫存目錄建立獨立專案、從 registry 安裝工具依賴、型別檢查、production build，於獨立 4174 port 啟動預覽，再以 Chromium 操作主題與元件並取得字體／授權。完成後關閉瀏覽器與伺服器並清除其暫存目錄。需網路及可用 4174 port；不發布 npm，不使用 workspace alias。

## 0.2.0 升級說明（草稿，待 ISSUE-014 完成）

### 整頁主題與防閃爍（ISSUE-007）

使用端可刪掉的自補程式：

- 在 `<head>` 手寫的首屏腳本：讀 `luca-style-mode`、跟隨 `prefers-color-scheme`、設定 `document.documentElement.dataset.mode`。改放 `themeInitScript({suite})` 的回傳字串。
- 把 `resolvedMode` 同步到 `<html>` 的 `useLayoutEffect`／`useEffect`（例如 `document.documentElement.dataset.mode = resolvedMode`）。改用 `<ThemeProvider target="document">`。
- 只為了讓整頁底色跟上主題而加的 `html { background:... }` 規則：`target="document"` 後 `<html>` 本身帶主題屬性，套件 CSS 會給它底色。若希望外部 CSS 到達前也有正確底色，可保留以 `html[data-mode="dark"]` 為條件的行內保底樣式。

注意事項：

- `suite="professional"` 的專案要把同一個套系傳給 `themeInitScript({suite:'professional'})`；沒傳時腳本以 `vibrant` 設定，React 掛載瞬間會閃一下套系。
- `persist={false}` 時不要放首屏腳本：腳本會讀 localStorage，與「不讀寫儲存」矛盾，屬於誤用。
- 偏好鍵名仍是 `luca-style-mode`，值仍為 `light`／`dark` 純字串；0.1.0 存下的選擇不需遷移。
- `target="document"` 後頁面上符合 `[data-luca-theme]` 的元素是 `<html>`，不再有外層 `div`；以該選擇器找主題容器的測試仍可用，但依賴外層 `div` 結構的 CSS 或測試要調整。

### 資訊密度與元件外形可單獨覆寫（ISSUE-008）

- 沒給 `density`、`shape` 時畫面與 0.1.0 相同，不需修改。
- 新增 CSS 變數 `--table-cell-padding-block`、`--table-cell-padding-inline`（預設 12px／8px，即 0.1.0 表格儲存格內距），也寫進設計檔變數。
- `--control-height` 改由密度等級提供，精緻專業 comfortable 為 52px；直接在頁面覆寫這些變數的寫法仍有效。

### 專案強調色改為 `AccentInput`（ISSUE-006）

舊的兩種寫法已移除，傳入會造成型別錯誤。新舊對照：

| 0.1.0 | 0.2.0 |
| --- | --- |
| `{primary, secondary, soft, ink}` | `{light: primary, secondary, soft: {light: soft}}`；`ink` 移除 |
| `{light: {primary, secondary, soft, ink}, dark: {primary, secondary, soft, ink}}` | `{light: light.primary, dark: dark.primary, secondary: light.secondary, soft: {light: light.soft, dark: dark.soft}}`；`dark.secondary`、兩個 `ink` 移除 |

注意事項：

- 顏色須為 `#RRGGBB`，其他寫法（`red`、`#abc`）會讓推算在 render 時拋錯。
- 點綴色只有一個值，兩種模式共用；0.1.0 的暗黑專屬點綴色無法表達（樣張原本的暗黑點綴 `#E6BE70` 因此不再使用）。沒給時沿用該模式的主色。
- `accent-ink`（填色按鈕上的文字）不再可覆寫，固定為日間白色、暗黑炭黑。有給的顏色原樣使用、不做對比檢查；日間主色很淺（例如亮黃）時白字對比會不足，請改用較深的主色。
- 推算的只有沒給的角色：暗黑主色、柔和底色、點綴色，以及一律推算的滑過、按下、焦點框色。推算值都通過文字對比 4.5:1（焦點框 3:1）；位移後不足時會再加深／加亮。
- 按鈕滑過不再用 `filter:brightness(.94)`，改為 `--accent-hover`；測試若斷言 `filter` 或焦點框粗細（舊為 3px 文字色單圈，現為 2px 表面色內圈＋2px 主色外圈）需調整。
- 新增的 CSS 變數：`--accent-hover`、`--accent-pressed`、`--focus-ring`；套系預設值在建置時算好，也寫進設計檔變數。
