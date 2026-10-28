# 依對標結論升級設計系統至 0.2.0

Blocked by: none

## Why

我們拿 7 個知名設計系統和 luca-style 比較（[對標研究](../research/design-system-benchmark.md)），發現 4 個主要缺口：

- 設計變數在程式和套系設計檔各存一份，靠人手同步。
- 專案強調色只換 4 個顏色，滑過、按下、焦點框不會跟著變。
- 資訊密度與元件外形綁死在風格套系上，不能單獨調。
- 沒有自動的無障礙檢查和截圖比對。

另外，兩個使用端專案（automated_trading、badminton）都各自補寫了「主題套到整頁」和「防閃爍」這兩段程式。Select 用原生下拉選單，外觀和其他元件不一致。

## Scope

- 設計變數改用 DTCG 標準格式，並自動寫入元件庫設計檔；兩份套系設計檔合併為一份不含頁面的元件庫。
- 資訊密度與元件外形可以單獨覆寫。
- 專案強調色從一個主色自動算出整組顏色。
- 主題控制：可以關閉偏好保存、可以把主題套到整頁、提供防閃爍腳本。
- 所有元件改用 Base UI，包含 Select。
- 品質檢查：axe 無障礙檢查、逐頁截圖比對、設計變數說明文件、`llms.txt` 與 `DESIGN.md`、組合完整性檢查。
- 發布 0.2.0，並寫升級說明。

## Promises

**設計變數**

PR-STYLE-25 — 設計變數的原始檔使用 DTCG 格式，每個變數都附用途說明。
PR-STYLE-26 — 任一「風格套系 × 明暗模式」組合缺少任何變數的值時，建置失敗並指出缺的是哪個變數。
PR-STYLE-27 — `@luca-style/tokens` 的 css、data、typography 三種輸出：既有變數的名稱、結構和值都與 0.1.0 相同。
PR-STYLE-28 — 建置會產生一份設計變數規格文件，列出每個變數在每種組合下的值和用途，給代理閱讀。

**套系設計檔**

PR-FILE-16 — 程式產生的設計變數寫入元件庫設計檔後，每種「套系 × 明暗」組合的值都與程式一致。
PR-FILE-17 — 元件庫設計檔的 Select 母版有「選單展開」狀態。
PR-FILE-18 — 元件庫設計檔只有一份，內容是設計變數與 23 個母版（含 `C/Select/Open`），以「套系」「明暗」兩組模式切換；母版的填色、描邊、字型、圓角綁定設計變數；沒有頁面 frame，節點數低於 10,000。
PR-FILE-19 — 使用端複製元件庫設計檔並匯入自己的強調色後，母版顯示該強調色；`docs/consumer-guide.md` 記錄此步驟，以及 luca-style 更新後如何重新匯入設計變數。

落地時改為 retired（不再有兩份檔案與頁面 frame）：PR-FILE-01～05、PR-FILE-10～13、PR-FILE-15；PR-FILE-11 的母版綁定由 PR-FILE-18 承接。PR-FILE-06～09、PR-FILE-14 保留。

**密度與外形**

PR-STYLE-29 — 專案沒有覆寫時，資訊密度與元件外形沿用所選風格套系的預設值，畫面與 0.1.0 相同。
PR-STYLE-30 — 專案可以單獨覆寫資訊密度，色彩與元件外形不受影響。
PR-STYLE-31 — 專案可以單獨覆寫元件外形，色彩與資訊密度不受影響。

**專案強調色**

PR-STYLE-32 — 專案強調色只有日間主色必填；暗黑主色、點綴色、柔和底色有給就用，沒給才由系統推算。風格套系的主色、點綴色、柔和底色維持人工設計值。
PR-STYLE-33 — 自動產生的強調色角色（含滑過、按下），在日間與暗黑都通過現有的文字對比門檻。
PR-STYLE-45 — 滑過與按下色由主色推算：色相不變，日間比主色深、暗黑比主色亮，按下的變化幅度大於滑過。
PR-STYLE-46 — 所有元件的焦點框為雙圈：內圈表面色、外圈主色；焦點框與底色的對比至少 3:1。
PR-STYLE-47 — 專案沒給點綴色時，點綴色沿用主色，不另外產生新色相。

**主題控制**

PR-STYLE-34 — `ThemeProvider` 可以關閉明暗偏好保存。關閉時完全不讀寫瀏覽器儲存。
PR-STYLE-35 — 開啟保存時，鍵名仍是 `luca-style-mode`；0.1.0 存下的選擇在 0.2.0 照樣有效。
PR-STYLE-36 — `ThemeProvider` 可以把主題屬性套在 `<html>` 上，頁面底色跟著主題變化，使用端不必自己補程式。
PR-STYLE-37 — 提供現成的首屏腳本：使用者之前選了暗黑，首次繪製就是暗黑，不會先閃一下日間。

**元件**

PR-STYLE-38 — 所有共用元件改由 Base UI 處理互動行為。每個元件的主要操作都能只靠鍵盤完成，焦點樣式在所有元件一致。
PR-STYLE-39 — Select 改用自訂選單，選單外觀跟著風格套系與明暗模式；可以用鍵盤開啟、選擇、關閉。
PR-STYLE-40 — 既有元件的公開 props 在 0.2.0 保持相容；做不到的地方逐一寫進升級說明。

**品質與文件**

PR-STYLE-41 — 樣張的每一頁、每種風格套系、每種明暗模式都跑 axe 檢查，沒有 serious 或 critical 等級的違規；其餘等級列在報告中。
PR-STYLE-42 — 樣張的每一頁、每種風格套系、每種明暗模式都有截圖基準；畫面與基準不符時測試失敗。
PR-STYLE-43 — 提供 `llms.txt` 與 `DESIGN.md`，說明套件、主題軸、元件與設計變數的用法。

**發布**

PR-STYLE-44 — 以 0.2.0 發布。`docs/consumer-guide.md` 有升級說明，列出使用端可以刪除的自補程式，以及可能需要調整的測試（例如 Select）。

## Out of scope

- **兩個使用端專案的升級**：由它們各自開議題處理，避免同時改三個 repo。
- **changesets 版本管理**：目前沒有外部使用者，延後。
- **由程式產生元件母版或頁面版面**：沒有可靠做法，母版仍以套系設計檔為準（ADR 0004）。
- **依頁面拆分套系設計檔**：ADR 0003 延後的另一件事。
- **新的複雜元件**（對話框、選單等）：這次只把既有元件換成 Base UI。
- **同一頁混用兩套風格套系**：ADR 0001 仍然禁止。
- **SSR 支援**。
- **在設計檔畫頁面範本**：頁面範本以樣張網站為準（ADR 0007）。兩個使用端專案既有的設計稿是否改用元件庫，留給它們的升級議題。
- **同步使用端舊設計稿的腳本**：等使用端真的需要再做。

## Decisions

- 設計變數以程式中的 DTCG 檔為正本，再匯入套系設計檔。不採用的做法：兩邊人工同步；只在輸出時多產生一份 DTCG。見 [ADR 0004](../adr/0004-design-variables-sourced-from-dtcg-tokens-and-imported-into-fig.md)。
- 風格套系改為提供密度與外形的預設值，專案可以覆寫。不採用的做法：維持綁死；完全拿掉套系。見 [ADR 0005](../adr/0005-style-suite-sets-overridable-density-and-shape-defaults.md)。
- 所有元件改用 Base UI，Select 也換。不採用的做法：React Aria Components、Radix、Ark；保留原生 select。見 [ADR 0006](../adr/0006-build-every-component-on-base-ui.md)。
- 專案強調色從一個主色產生整組角色。不採用的做法：維持手給 4 個變數。見 [decision-log](../decision-log.md) 2026-10-28。
- 使用者在選色頁比較後決定：滑過與按下用 OKLCH 明度位移（不採用：混入文字色、維持調暗 6%）；焦點框用雙圈（不採用：主色單圈、文字色單圈）；日間主色必填、其餘選填（不採用：只給日間主色、全部必填）；沒給點綴色時沿用主色（不採用：互補色、鄰近色）。見 decision-log。
- 明暗偏好保存保留在設計系統內，但可以關閉。不採用的做法：整個移交給使用端。見 decision-log。
- 主題可以套到整頁並提供防閃爍腳本。不採用的做法：維持由使用端自補。見 decision-log。
- changesets 延後；`llms.txt` 與 `DESIGN.md` 這次就做。見 decision-log。
- 設計檔只保留一份元件庫（設計變數與母版），以模式切換套系，沒有頁面；使用端複製它開始畫設計稿。不採用：維持兩份含頁面的套系設計檔；完全不要設計檔；OpenPencil 發布元件庫。見 [ADR 0007](../adr/0007-keep-one-component-library-design-file-without-pages.md)。
- 設計變數以離線腳本 `apply-variables.js` 寫入設計檔，取程式與設計檔變數的聯集。不採用：`import_design_tokens`（需開 App）；只放程式既有變數。見 ADR 0004。
- 專案強調色的舊寫法（`{primary, secondary, soft, ink}`、`{light, dark}`）不保留，直接換成 `AccentInput`，在升級說明寫清楚。不採用：保留舊寫法相容。見 decision-log。
- axe 只擋 serious 和 critical 等級，其餘列在報告。不採用：零違規。見 decision-log。
- 截圖基準用 Playwright 官方 Linux Docker 映像產生並存進 repo，CI 與本機更新都用同一映像。不採用：本機 Windows 產生；各平台各存一份。見 decision-log。
- 技術選擇（Base UI 套件為 `@base-ui/react` ^1.9、Style Dictionary、密度與外形用具名等級、強調色計算位置）與公開合約見 [架構 §3.1、§3.3](../03_architecture_design.md) 與 decision-log。

## Open questions

1. ~~Base UI 的套件名稱、版本，以及能否搭配 React 19~~：已定，見 Decisions。
2. ~~專案強調色的舊寫法是否保留相容~~：已定為不保留，見 Decisions。
3. ~~axe 的通過門檻~~：已定為只擋 serious 和 critical，見 Decisions。
4. ~~截圖基準在哪個環境產生~~：已定為 Playwright 官方 Linux Docker 映像，見 Decisions。
5. ~~密度覆寫的形式~~：已定為具名等級，各等級數值由前端規格定義。
6. ~~元件外形覆寫的形式~~：已定為具名等級，同上。
