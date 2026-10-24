# 設計系統架構

## 3.1 技術棧與交付結構（能力：設計系統）

| 層次 | 選擇 | 決策依據 |
| --- | --- | --- |
| 共用元件 | React + TypeScript；兩套風格共用元件行為 | [決策紀錄](decision-log.md) |
| 樣式 | CSS variables，承接風格套系、明暗模式及專案強調色覆寫 | [決策紀錄](decision-log.md) |
| 套件管理 | npm workspaces | [決策紀錄](decision-log.md) |
| 設計變數 | 單一結構化來源，產生 CSS 與供程式使用的資料 | [決策紀錄](decision-log.md) |
| 樣張網站 | 引用正式套件，展示元件、雙風格、明暗模式及頁面範本 | [決策紀錄](decision-log.md) |
| 設計資產 | 套系設計檔（OpenPencil .fig）與程式共用變數及元件命名，人工同步並核對 | [決策紀錄](decision-log.md) |

| 目錄 | 責任 |
| --- | --- |
| `packages/tokens/` | 設計變數來源、產生器與輸出 |
| `packages/react/` | 共用 React 元件與主題控制 |
| `apps/showcase/` | 使用說明、元件樣張及產品介面與介紹頁範本 |
| `docs/mockup/` | 套系設計檔（`components-vibrant.fig`、`components-professional.fig`） |

| 部署 | 方式 |
| --- | --- |
| GitHub Pages | `.github/workflows/pages.yml` 在 push 到 `main` 時執行：驗證 job 依序跑 build、typecheck、lint 與 Playwright，通過後才由 deploy job 部署；任一步失敗就不部署，線上維持上一版 |
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
```

- `vibrant` 對應精緻活力，`professional` 對應精緻專業。
- `system` 表示跟隨裝置設定；`light` 與 `dark` 表示使用者明確選擇的模式。
- 主題控制提供主題容器與切換介面；使用者偏好保存在目前網站，各專案不共用偏好。
- 元件透過語意設計變數取色，不直接綁定色票數值；專案強調色覆寫不改變語意狀態色的意思。
- 樣張與頁面範本使用正式套件的公開介面，展示內容與使用端專案沿用相同契約。
- 本範圍的公開合約為套件輸出及元件介面，沒有伺服器資料或 HTTP API。

## 3.4 視覺規格與交付邊界（能力：設計系統）

需求承諾以[設計系統需求承諾](capabilities/design-system.md#需求承諾)的 `PR-STYLE-01` 至 `PR-STYLE-14` 為依據。

前端規格定義電腦、平板與手機的字級角色、行高、字重、間距、元件狀態及版面響應規則。套系間以色彩、密度與元件外形形成差異，共用字體角色與元件行為。

設計變數的程式輸出與 CSS 由同一來源產生；套系設計檔的對應關係由人工同步及核對維持；兩檔各帶一份相同的 22 個母版，以 `scripts/design/check-masters.js` 比對。範本涵蓋產品介面與介紹頁的桌面、手機呈現。

能力對照見 [設計系統](capabilities/design-system.md)。
