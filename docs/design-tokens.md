# 設計變數規格

> 由 `npm run generate` 自 `packages/tokens/src` 的 DTCG 原始檔產生，勿手改；要改值或用途請改原始檔後重跑。

變數名即 CSS 自訂屬性名（加 `--`），也是 `@luca-style/tokens/data` 的鍵；值與 `@luca-style/tokens/css`、`@luca-style/tokens/data` 相同。滑過、按下與焦點框由主色推算。

## 設計變數

| 變數 | 用途 | vibrant / light | vibrant / dark | professional / light | professional / dark |
| --- | --- | --- | --- | --- | --- |
| `font-body` | 內文與介面文字的字型堆疊 | `Inter, 'Noto Sans TC', sans-serif` | `Inter, 'Noto Sans TC', sans-serif` | `Inter, 'Noto Sans TC', sans-serif` | `Inter, 'Noto Sans TC', sans-serif` |
| `font-data` | 數據、代碼與需要數字對齊處的等寬字型 | `'IBM Plex Mono', monospace` | `'IBM Plex Mono', monospace` | `'IBM Plex Mono', monospace` | `'IBM Plex Mono', monospace` |
| `space-1` | 間距刻度 1（4px），用於內距與元素間距 | `0.25rem` | `0.25rem` | `0.25rem` | `0.25rem` |
| `space-2` | 間距刻度 2（8px），用於內距與元素間距 | `0.5rem` | `0.5rem` | `0.5rem` | `0.5rem` |
| `space-3` | 間距刻度 3（12px），用於內距與元素間距 | `0.75rem` | `0.75rem` | `0.75rem` | `0.75rem` |
| `space-4` | 間距刻度 4（16px），用於內距與元素間距 | `1rem` | `1rem` | `1rem` | `1rem` |
| `space-6` | 間距刻度 6（24px），用於內距與元素間距 | `1.5rem` | `1.5rem` | `1.5rem` | `1.5rem` |
| `space-8` | 間距刻度 8（32px），用於內距與元素間距 | `2rem` | `2rem` | `2rem` | `2rem` |
| `space-12` | 間距刻度 12（48px），用於內距與元素間距 | `3rem` | `3rem` | `3rem` | `3rem` |
| `space-16` | 間距刻度 16（64px），用於內距與元素間距 | `4rem` | `4rem` | `4rem` | `4rem` |
| `motion-feedback` | 即時回饋的動效時長，例如滑過與按下 | `120ms` | `120ms` | `120ms` | `120ms` |
| `motion-standard` | 一般狀態轉換的動效時長 | `180ms` | `180ms` | `180ms` | `180ms` |
| `motion-region` | 區塊展開、收合等大範圍變化的動效時長 | `240ms` | `240ms` | `240ms` | `240ms` |
| `accent-hover` | 主要強調色的滑過狀態：建置時由該套系與明暗的 accent 以 deriveAccent 推算（OKLCH 明度日間 -0.05、暗黑 +0.05，不過文字對比門檻再加深／加亮），此處的參照只是占位 | `#007072` | `#75D2CC` | `#544E74` | `#BBB4E8` |
| `accent-pressed` | 主要強調色的按下狀態：建置時由 accent 以 deriveAccent 推算（OKLCH 明度位移 0.10，且至少比滑過多 0.05），此處的參照只是占位 | `#006062` | `#85E3DC` | `#474065` | `#CBC4F9` |
| `focus-ring` | 焦點框外圈色（內圈為 surface）：建置時以 deriveAccent 推算，與 bg、surface、surface-subtle 對比至少 3:1 時即為 accent，此處的參照只是占位 | `#147F82` | `#64C2BC` | `#625C83` | `#ABA4D7` |
| `bg` | 頁面底色 | `#F7F7F2` | `#151A18` | `#F7F7F2` | `#151A18` |
| `surface` | 卡片與面板的表面色 | `#FFFFFF` | `#1D2420` | `#FFFFFF` | `#1D2420` |
| `surface-subtle` | 次要表面色，用於區隔區塊、表頭與輸入底 | `#F1F3EE` | `#252E28` | `#F1F3EE` | `#252E28` |
| `text` | 主要文字色 | `#24312A` | `#EDF3ED` | `#24312A` | `#EDF3ED` |
| `muted` | 次要文字色，用於說明與輔助資訊 | `#626F65` | `#A5B5A8` | `#626F65` | `#A5B5A8` |
| `border` | 分隔線與卡片邊框色 | `#DDE5DC` | `#354139` | `#DDE5DC` | `#354139` |
| `control-border` | 操作元件的邊框色，與底色保有可辨識的對比 | `#7B8C80` | `#65766B` | `#7B8C80` | `#65766B` |
| `accent-ink` | 放在強調色底上的文字與圖示色 | `#FFFFFF` | `#151A18` | `#FFFFFF` | `#151A18` |
| `control-height` | 操作元件（按鈕、輸入框、下拉選單）的最小高度 | `3rem` | `3rem` | `3rem` | `3rem` |
| `card-padding` | 卡片內距 | `1.5rem` | `1.5rem` | `1.25rem` | `1.25rem` |
| `gap-section` | 頁面區段之間的間距 | `2rem` | `2rem` | `1.5rem` | `1.5rem` |
| `table-cell-padding-block` | 表格儲存格的上下內距 | `.75rem` | `.75rem` | `.75rem` | `.75rem` |
| `table-cell-padding-inline` | 表格儲存格的左右內距 | `.5rem` | `.5rem` | `.5rem` | `.5rem` |
| `radius-card` | 卡片與容器的圓角 | `1.25rem` | `1.25rem` | `.1875rem` | `.1875rem` |
| `radius-control` | 按鈕與操作元件的圓角 | `1rem` | `1rem` | `.1875rem` | `.1875rem` |
| `border-width` | 卡片與操作元件的邊框粗細 | `1px` | `1px` | `1.5px` | `1.5px` |
| `metric-border-left` | 指標卡左側邊框的粗細 | `1px` | `1px` | `3px` | `3px` |
| `metric-shadow` | 指標卡的陰影；none 表示不加陰影。設計檔以布林變數 elevation-enabled 表示（none 為 false，其他為 true） | `0 4px 16px #00000008` | `0 4px 16px #00000008` | `none` | `none` |
| `metric-background` | 指標卡的底色，可參照其他變數。設計檔中名為 card-highlight | `var(--accent-soft)` | `var(--accent-soft)` | `var(--surface)` | `var(--surface)` |
| `success` | 語意狀態色：成功；須搭配文字或圖示，不單靠顏色傳達 | `#237354` | `#7ED4AB` | `#356858` | `#93C6B2` |
| `warning` | 語意狀態色：警告；須搭配文字或圖示，不單靠顏色傳達 | `#886018` | `#EAC678` | `#80601F` | `#DBC28B` |
| `error` | 語意狀態色：錯誤；須搭配文字或圖示，不單靠顏色傳達 | `#B24445` | `#F29C96` | `#A34B5C` | `#DDA3B2` |
| `accent` | 主要強調色，用於主要按鈕、連結與選取狀態 | `#147F82` | `#64C2BC` | `#625C83` | `#ABA4D7` |
| `accent-secondary` | 點綴色，用於次要強調與裝飾。設計檔中名為 secondary | `#DF826D` | `#E8A18B` | `#6799B9` | `#8BBDD8` |
| `accent-soft` | 柔和強調底色，用於選取列、標籤與指標卡底 | `#E3F2F0` | `#173637` | `#EEEDF4` | `#2D2A3B` |

## 資訊密度

各風格套系的預設等級：vibrant 為 standard、professional 為 standard。套系區塊已含預設等級的值；專案以 `density` 覆寫，覆寫只改下表的變數。

| 變數 | 用途 | vibrant/compact | vibrant/standard | vibrant/comfortable | professional/compact | professional/standard | professional/comfortable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `control-height` | 操作元件（按鈕、輸入框、下拉選單）的最小高度 | `2.5rem` | `3rem` | `3.5rem` | `2.5rem` | `3rem` | `3.25rem` |
| `card-padding` | 卡片內距 | `1rem` | `1.5rem` | `2rem` | `.75rem` | `1.25rem` | `1.5rem` |
| `gap-section` | 頁面區段之間的間距 | `1.5rem` | `2rem` | `3rem` | `1rem` | `1.5rem` | `2rem` |
| `table-cell-padding-block` | 表格儲存格的上下內距 | `.5rem` | `.75rem` | `1rem` | `.375rem` | `.75rem` | `.875rem` |
| `table-cell-padding-inline` | 表格儲存格的左右內距 | `.5rem` | `.5rem` | `.75rem` | `.5rem` | `.5rem` | `.625rem` |

## 元件外形

各風格套系的預設等級：vibrant 為 rounded、professional 為 sharp。專案以 `shape` 覆寫，覆寫只改下表的變數。

| 變數 | 用途 | rounded | sharp |
| --- | --- | --- | --- |
| `radius-card` | 卡片與容器的圓角 | `1.25rem` | `.1875rem` |
| `radius-control` | 按鈕與操作元件的圓角 | `1rem` | `.1875rem` |
| `border-width` | 卡片與操作元件的邊框粗細 | `1px` | `1.5px` |
| `metric-border-left` | 指標卡左側邊框的粗細 | `1px` | `3px` |
| `metric-shadow` | 指標卡的陰影；none 表示不加陰影。設計檔以布林變數 elevation-enabled 表示（none 為 false，其他為 true） | `0 4px 16px #00000008` | `none` |
| `metric-background` | 指標卡的底色，可參照其他變數。設計檔中名為 card-highlight | `var(--accent-soft)` | `var(--surface)` |

## 字體角色

不分風格套系與明暗。CSS 變數為 `--type-<角色>-size`、`--type-<角色>-weight`、`--type-<角色>-line-height`；字級依裝置寬度切換（平板 600px 起、桌面 1024px 起）。

| 角色 | 手機 | 平板 | 桌面 | 字重 | 行高 |
| --- | --- | --- | --- | --- | --- |
| `hero` | `2rem` | `2.75rem` | `3.5rem` | `700` | `1.2` |
| `title` | `1.5rem` | `1.75rem` | `2rem` | `700` | `1.3` |
| `section` | `1.25rem` | `1.375rem` | `1.5rem` | `600` | `1.4` |
| `card` | `1.125rem` | `1.125rem` | `1.125rem` | `600` | `1.5` |
| `body` | `1rem` | `1rem` | `1rem` | `400` | `1.75` |
| `control` | `1rem` | `1rem` | `1rem` | `500` | `1.5` |
| `secondary` | `.875rem` | `.875rem` | `.875rem` | `400` | `1.6` |
| `helper` | `.75rem` | `.75rem` | `.75rem` | `500` | `1.5` |
