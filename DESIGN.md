# Luca Style 設計系統（給代理讀）

這份文件寫給要在專案裡使用 Luca Style 的代理。先看「決策規則」決定怎麼選，再看「主題軸」與「API」照著寫。術語依 [GLOSSARY.md](https://github.com/Luca0x5755/luca-style/blob/main/GLOSSARY.md)。

## 套件

| 套件 | 內容 |
| --- | --- |
| `@luca-style/tokens` | 設計變數：`/css`（CSS 自訂屬性）、`/data`（以套系、明暗兩層索引的 JSON）、`/typography`（響應式字體角色）、`/accent`（`deriveAccent` 推算函式）。 |
| `@luca-style/react` | React 19 元件與主題控制，互動行為由 Base UI 處理；`/css` 是元件樣式，`/fonts.css` 自行託管 Inter、Noto Sans TC、IBM Plex Mono。 |

兩個套件版本須一致。每個變數在每種「套系 × 明暗」組合下的值與用途，見[設計變數規格](https://github.com/Luca0x5755/luca-style/blob/main/docs/design-tokens.md)（隨 `@luca-style/tokens` 發布為 `design-tokens.md`，由 DTCG 原始檔產生，是變數值的唯一依據；不要憑記憶或從本文件抄值）。

## 決策規則

1. 一個專案只選一套風格套系，整站沿用，不在同一頁混用兩套。活動、社群等親和型產品選精緻活力（`vibrant`）；金融、資料監控等高密度產品選精緻專業（`professional`）。
2. 要調鬆緊或圓角，不要換套系：用 `density` 覆寫資訊密度，用 `shape` 覆寫元件外形。色彩仍依所選套系。
3. 要用品牌色，用專案強調色（`accent`），不要改套系的設計變數檔。只有日間主色必填，其餘由系統推算；語意狀態色（`--success`、`--warning`、`--error`）不會因強調色而改變意思。
4. 成功、警告、錯誤只表示操作結果，且要搭配文字或圖示，不單靠顏色。紅綠漲跌、類別色這類業務資料色由各專案自己命名變數、自己定義，不要拿 `--success`、`--error` 當資料色。
5. 顏色、間距、圓角、字級一律用設計變數（`var(--surface)`、`var(--space-4)`），不要寫死色票數值。
6. 文字角色（字級、字重、行高）不隨密度改變；不要用縮小字級來提高密度。

## 主題軸

| 軸 | `ThemeProvider` 的 prop | 可用值 | 預設 |
| --- | --- | --- | --- |
| 風格套系 | `suite` | `vibrant`、`professional` | `vibrant` |
| 明暗模式 | 不是 prop，用 `useTheme()` 的 `setMode` | `system`、`light`、`dark` | `system`（跟隨裝置） |
| 資訊密度 | `density` | `compact`、`standard`、`comfortable` | 依套系（兩套皆為 `standard`） |
| 元件外形 | `shape` | `rounded`、`sharp` | 依套系（`vibrant` 為 `rounded`，`professional` 為 `sharp`） |
| 專案強調色 | `accent` | `AccentInput` | 套系預設色 |

`ThemeProvider` 的其他 props：`persist`（預設 `true`，明暗偏好存於 localStorage 鍵 `luca-style-mode`；`false` 時完全不讀寫儲存）、`target`（`self` 或 `document`，預設 `self`）、`children`。各等級的數值見設計變數規格的「資訊密度」「元件外形」。

`AccentInput` 的欄位：`light`（日間主色，唯一必填）、`dark`（暗黑主色）、`secondary`（點綴色，沒給就沿用主色）、`soft`（柔和底色，`{light?, dark?}`）。沒給的由 `deriveAccent` 推算；滑過 `--accent-hover`、按下 `--accent-pressed`、焦點框 `--focus-ring` 一律由主色推算。有給的顏色原樣使用、不做對比檢查，日間主色太淺時主按鈕的白字會看不清，請自行確認。

## 接入

入口載入三份樣式，用 `ThemeProvider` 包住應用，需要明暗切換時在 Provider 內用 `useTheme()`：

```tsx
import '@luca-style/tokens/css';
import '@luca-style/react/fonts.css';
import '@luca-style/react/css';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, Select, useTheme } from '@luca-style/react';

function ModeControl() {
  const { mode, setMode } = useTheme();
  return (
    <Select label="明暗模式" value={mode} onChange={event => setMode(event.target.value as typeof mode)}>
      <option value="system">跟隨系統</option>
      <option value="light">日間</option>
      <option value="dark">暗黑</option>
    </Select>
  );
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider suite="professional" density="compact" accent={{ light: '#275A83', soft: { light: '#E7F0F7' } }}>
    <ModeControl />
  </ThemeProvider>,
);
```

整頁底色要跟著主題變、並避免首次繪製先閃日間時，用 `target="document"`（主題屬性與強調色套在 `<html>`），再把 `themeInitScript` 注入 `<head>`。`suite` 兩邊要相同；首屏腳本會讀 localStorage，不要與 `persist={false}` 一起用。它不處理 `density`、`shape`：搭配覆寫時，掛載前會先用套系預設值排版。

```ts
import { defineConfig } from 'vite';
import { themeInitScript } from '@luca-style/react';

export default defineConfig({
  plugins: [{
    name: 'luca-theme-init',
    transformIndexHtml: () => [{ tag: 'script', children: themeInitScript({ suite: 'professional' }), injectTo: 'head-prepend' }],
  }],
});
```

```tsx
import { ThemeProvider } from '@luca-style/react';

export const App = () => (
  <ThemeProvider suite="professional" target="document">
    <main>內容</main>
  </ThemeProvider>
);
```

## 元件

| 元件 | 用途 | 重點 props |
| --- | --- | --- |
| `Button` | 按鈕 | `variant`（`primary`、`secondary`）、`loading` |
| `TextField` | 文字欄位 | `label`、`helper`、`error` |
| `Select` | 自訂下拉選單，選項仍以 `<option>` 描述 | `label`、`value`、`onChange`（收到的 `event.target.value` 是選到的值） |
| `Checkbox` | 核取方塊 | `label`、`checked`、`onChange` |
| `StatusMessage` | 操作結果訊息 | `tone`（`success`、`warning`、`error`） |
| `ContentState` | 載入、空白、錯誤狀態 | `state`、`title`、`description`、`onRetry` |
| `Navigation` | 主要導覽 | `items`、`currentPath`、`brand`、`brandHref`、`label` |
| `MetricCard` | 指標卡 | `label`、`value`、`detail`、`eyebrow`、`highlight` |
| `DataTable` | 資料表 | `caption`、`columns`、`rows`、`rowKey` |

```tsx
import { useState } from 'react';
import { Button, Checkbox, ContentState, DataTable, MetricCard, StatusMessage, TextField } from '@luca-style/react';

type Row = { id: string; name: string; amount: number };
const rows: Row[] = [{ id: 'a', name: '專案 A', amount: 120 }];

export function Panel() {
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <section>
      <MetricCard label="本月完成" value="12" detail="比上月多 2 件" highlight />
      <TextField label="名稱" helper="最多 20 字" />
      <Checkbox label="同意條款" checked={done} onChange={event => setDone(event.target.checked)} />
      <Button loading={saving} onClick={() => setSaving(true)}>送出</Button>
      <StatusMessage tone="success">已儲存</StatusMessage>
      <ContentState state="empty" />
      <DataTable
        caption="專案清單"
        rows={rows}
        rowKey={row => row.id}
        columns={[{ key: 'name', heading: '名稱', render: row => row.name }, { key: 'amount', heading: '金額', render: row => row.amount }]}
      />
    </section>
  );
}
```

所有元件的主要操作都能只靠鍵盤完成，焦點框一致（雙圈：內圈表面色、外圈主色）。

## 設計變數怎麼用

CSS 變數名就是設計變數名加 `--`；在 JavaScript 取值用 `@luca-style/tokens/data`，以 `data[套系][明暗][變數名]` 索引。樣式裡引用變數，讓值隨套系、明暗、密度、外形變化：

```css
.card {
  background: var(--surface);
  color: var(--text);
  padding: var(--card-padding);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-card);
}
.card h2 { font-size: var(--type-title-size); font-weight: var(--type-title-weight); line-height: var(--type-title-line-height); }
```

字級角色是 `--type-<角色>-size`、`--type-<角色>-weight`、`--type-<角色>-line-height`，角色清單見設計變數規格的「字體角色」。版面間距用 `--space-1`、`--space-2`、`--space-4` 等階層變數。

## 設計稿

設計稿從元件庫設計檔 `docs/mockup/luca-style-library.fig` 複製開始（設計變數與 23 個母版，以套系與明暗模式切換）。頁面範本以線上樣張網站為準。使用端匯入自己的強調色與更新後重新匯入的步驟，見[使用端接入](https://github.com/Luca0x5755/luca-style/blob/main/docs/consumer-guide.md)。
