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

Provider 下透過 `useTheme()` 取得 `mode`、`resolvedMode`、`setMode`。呼叫 `setMode('light' | 'dark' | 'system')` 切換；首次跟隨系統、手動選擇記於目前 origin 的 localStorage，system 移除偏好。Provider 不接收 mode prop，控制必須在 Provider 內。

`accent={{primary,secondary,soft,ink}}` 覆寫專案強調色；primary 必填，其他選填。可用 `accent={{light: lightPalette, dark: darkPalette}}` 提供成對色票，ThemeProvider 依實際明暗模式即時選用；單一色票仍適用兩種模式，呼叫端須確認對比。Showcase 日間覆寫使用暖銅色與淺暖底，暗黑使用亮珊瑚色與深暖底。覆寫不改 success／warning／error。業務資料另定 `--data-positive` 等專案變數，使用文字、符號或圖例；不要引用 `--success`／`--error` 代表漲跌。

套系預設透過 `--card-padding`、`--gap-section` 控制密度。特定頁面可用 CSS 在自身區域覆寫這些變數，例如 `.dense-section { --card-padding:var(--space-4); --gap-section:var(--space-4); }`；不改文字角色或全域套系。自行版面使用 `--space-*`，欄位設定 `min-width:0`，窄版堆疊，表格保留可聚焦的水平捲動區。

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
