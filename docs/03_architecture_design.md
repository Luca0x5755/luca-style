# 設計系統架構

## 3.1 技術棧與交付結構（能力：設計系統）

| 層次 | 選擇 | 決策依據 |
| --- | --- | --- |
| 共用元件 | React + TypeScript；互動行為、鍵盤與焦點由 Base UI（`@base-ui/react` ^1.9）處理；peer 為 `react`、`react-dom` 19 | [ADR 0006](adr/0006-build-every-component-on-base-ui.md) |
| 樣式 | CSS variables，承接風格套系、明暗模式、密度等級、元件外形及專案強調色覆寫 | [ADR 0005](adr/0005-style-suite-sets-overridable-density-and-shape-defaults.md) |
| 套件管理 | npm workspaces | [決策紀錄](decision-log.md) |
| 設計變數 | DTCG 格式的單一來源，經 Style Dictionary 產生 CSS、程式資料、元件庫設計檔變數與代理用規格文件 | [ADR 0004](adr/0004-design-variables-sourced-from-dtcg-tokens-and-imported-into-fig.md) |
| 樣張網站 | 引用正式套件，展示元件、雙風格、明暗模式及頁面範本；頁面範本以此為準 | [決策紀錄](decision-log.md) |
| 設計資產 | 一份元件庫設計檔（Penpot 匯出檔 .penpot），只含設計變數與 23 個母版，以 `Suite x Mode` 一個集合的四個「套系 / 明暗」模式切換；使用端設計稿由它複製開始 | [ADR 0007](adr/0007-keep-one-component-library-design-file-without-pages.md) |
| 品質檢查 | Playwright 搭配 `@axe-core/playwright`，並逐頁 × 套系 × 明暗截圖比對 | [決策紀錄](decision-log.md) |

| 目錄 | 責任 |
| --- | --- |
| `packages/tokens/` | 設計變數 DTCG 來源、產生器與輸出 |
| `packages/react/` | 共用 React 元件與主題控制 |
| `apps/showcase/` | 使用說明、元件樣張及產品介面與介紹頁範本 |
| `docs/mockup/` | 元件庫設計檔 `luca-style-library.penpot` |

| 部署 | 方式 |
| --- | --- |
| GitHub Pages | `.github/workflows/pages.yml` 在 push 到 `main` 與 PR 時執行：驗證 job 依序跑 build、typecheck、lint 與 Playwright；只有 push 到 `main` 且驗證通過才由 deploy job 部署；任一步失敗就不部署，線上維持上一版 |
| 部署內容 | `npm run build:pages` 以 `/luca-style/` 為 base 輸出到 `apps/showcase/dist-pages`，內含每個路由的 `index.html` 與 `404.html` |
| 權限與版本 | 預設只讀；僅 deploy job 取得 `pages: write` 與 `id-token: write`。所有 action 固定到 commit SHA |
| 前提 | repo Settings → Pages 的來源須設為「GitHub Actions」；`test:consumer` 需網路與獨立 port，不列入此工作流程 |

## 3.2 資料模型與所有權（能力：設計系統）

| 資料 | 所有權與關係 |
| --- | --- |
| 風格套系 | 專案選定精緻活力或精緻專業；專案內頁面沿用同一套系，可依內容調整密度 |
| 明暗偏好 | 使用者選擇；未設定時跟隨裝置，手動選擇後記住偏好 |
| 設計變數 | 設計系統維護；相同角色對應各風格套系與明暗模式的值 |
| 專案強調色 | 使用端專案提供覆寫，維持語意狀態色的意義 |
| 語意狀態色 | 設計系統統一管理成功、警告及錯誤角色 |
| 業務資料色 | 使用端專案另行定義，不承擔共用元件的操作結果語意 |

風格套系的專案邊界見 [ADR 0001](adr/0001-select-one-style-suite-per-project.md)。語意狀態色與業務資料色的分離見 [ADR 0002](adr/0002-separate-status-colors-from-domain-data-colors.md)。

## 3.3 套件與主題公開合約（能力：設計系統）

```ts
type StyleSuite = "vibrant" | "professional";
type ColorMode = "system" | "light" | "dark";
type Density = "compact" | "standard" | "comfortable";
type Shape = "sharp" | "rounded";
type AccentInput = {
  light: string;
  dark?: string;
  secondary?: string;
  soft?: { light?: string; dark?: string };
};

type ThemeProviderProps = {
  suite?: StyleSuite;              // 預設 "vibrant"
  accent?: AccentInput;
  density?: Density;               // 預設依風格套系
  shape?: Shape;                   // 預設依風格套系
  persist?: boolean;               // 預設 true
  target?: "self" | "document";    // 預設 "self"
  children: React.ReactNode;
};

declare function themeInitScript(options?: { suite?: StyleSuite }): string; // suite 預設 "vibrant"
```

- `vibrant` 對應精緻活力，`professional` 對應精緻專業。
- `system` 表示跟隨裝置設定；`light` 與 `dark` 表示使用者明確選擇的模式。
- 主題控制提供主題容器與切換介面；使用者偏好保存在目前網站，各專案不共用偏好。
- `persist` 為 `true` 時，偏好存於瀏覽器儲存鍵 `luca-style-mode`；為 `false` 時不讀寫瀏覽器儲存。
- `target` 為 `"document"` 時，主題屬性（`data-luca-theme`、`data-suite`、`data-mode`）與強調色變數套在 `<html>`，不另包外層元素；卸載時移除。`themeInitScript()` 回傳不依賴任何 import 的首屏腳本字串，放在 `<head>`，在 React 掛載前依已存偏好設定 `<html>` 的三個主題屬性；`suite` 須與 `ThemeProvider` 相同。首屏腳本會讀取儲存，只與 `persist` 為 `true` 搭配。
- 未指定 `density`、`shape` 時沿用風格套系的預設值；各等級的數值由前端規格定義。
- `AccentInput` 只有 `light` 必填；`dark`、`soft` 未給時由 `ThemeProvider` 推算，`secondary` 未給時沿用該模式的主色，有給則兩種模式共用。滑過、按下與焦點框（CSS 變數 `--accent-hover`、`--accent-pressed`、`--focus-ring`）由主色推算；風格套系預設色的推算值在建置時產生，也寫入設計檔變數。推算函式 `deriveAccent(input, mode, neutrals)` 只有一份，由 `@luca-style/tokens/accent` 匯出，建置、`ThemeProvider` 與設計檔匯入腳本共用。
- 元件透過語意設計變數取色，不直接綁定色票數值；專案強調色覆寫不改變語意狀態色的意思。
- 樣張與頁面範本使用正式套件的公開介面，展示內容與使用端專案沿用相同契約。
- 本範圍的公開合約為套件輸出及元件介面，沒有伺服器資料或 HTTP API。

## 3.4 視覺規格與交付邊界（能力：設計系統）

需求承諾以[設計系統需求承諾](capabilities/design-system.md#需求承諾)的 `PR-STYLE-01` 至 `PR-STYLE-14` 為依據。

前端規格定義電腦、平板與手機的字級角色、行高、字重、間距、元件狀態及版面響應規則。套系間以色彩、密度與元件外形形成差異，共用字體角色與元件行為。

設計變數的程式輸出、CSS 與元件庫設計檔的變數由同一份 DTCG 來源產生；元件庫設計檔的變數以離線腳本 `scripts/design/apply-variables.js` 寫入，23 個母版人工維護並綁定設計變數。使用端的設計稿複製元件庫設計檔開始，設計變數可重新匯入。範本涵蓋產品介面與介紹頁的桌面、手機呈現，以樣張網站為準。

能力對照見 [設計系統](capabilities/design-system.md)。
