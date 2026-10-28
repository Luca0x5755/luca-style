# 高星設計系統對標研究

日期：2026-10-28。比較對象：Radix Themes、shadcn/ui、Ant Design（v6）、Adobe React Spectrum／Spectrum 2、IBM Carbon、GitHub Primer、Chakra UI v3／Park UI。

方法：各專案淺層 clone，深讀 token 架構、主題軸、設計檔同步三項原始碼；元件 API、文件、測試、發佈只讀文件。本文是研究結論，不是決策；採納與否見後續 ADR 或 [decision-log](../decision-log.md)。

## 差異矩陣

| 維度 | luca-style | Radix | shadcn | Ant | Spectrum | Carbon | Primer | Chakra |
|---|---|---|---|---|---|---|---|---|
| Token 分層 | 只有語意一層 | 色階→語意→元件 | 只有語意一層 | Seed→Map→Alias→元件 | 結構化資料＋conceptId | 色板→語意→元件 | base→functional→component | tokens→semanticTokens |
| Token 格式 | 自訂 JSON | 手寫 CSS | TS 物件 | TS＋演算法 | 自訂 JSON Schema | DTCG | DTCG（JSON5） | TS 設定 |
| 驗證 | 產生器、對比測試 | 無 | registry 驗證 | typedoc | 涵蓋率規則 | 主題 parity 測試、schema | Zod schema、對比 CI、移除清單 | typegen |
| 明暗表達 | `modes` 獨立兩棵 | `.light/.dark` class | `.dark` class | darkAlgorithm | `light-dark()` | 主題本身（g10/g100） | data 屬性，亮暗各選主題 | 同一 token 內條件值 |
| 密度／圓角 | 綁在套系 | `--scaling`、`--radius-factor` 乘數 | `--radius` calc 衍生 | compactAlgorithm，可疊加 | `--s2-scale` 倍率 | 元件 `size` | pointer 分流 | radius 語意層 `l1-3` |
| 強調色覆寫 | 換 4 個變數 | 換整組 12 階 | theme 覆寫 primary 等 | 從 seed 演算整套 | 不開放自訂 | 主題固定 | 主題固定 | colorPalette 角色組 |
| 巢狀主題 | CSS 選擇器可巢狀，Provider 各自存偏好 | `<Theme>` 繼承 | 無 | ConfigProvider 繼承 | Provider 繼承 | zone＋layer | data 屬性 | 條件 |
| 偏好保存 | 元件庫負責 | 交給 app | 交給 app | 交給 app | 交給 app | 交給 app | 交給 app | 交給 app |
| 行為／a11y 層 | 自寫 | Radix Primitives | Radix／Base UI／Aria | 自寫 | React Aria | 自寫 | 自寫 | Ark／Zag |
| 設計檔正本 | `.fig` 為正本，人工同步＋核對 | 無官方檔 | 無官方檔 | Sketch，不同步 | Tokens Studio→資料，轉向資料為正本 | DTCG 為正本，Code Connect | 程式→Figma 單向，Code Connect | Figma 套件，人工 |
| a11y 自動測試 | 無 axe | 無 | 無 | jest-axe | axe-playwright、forced-colors | IBM checker、92 支 avt | 每 story×9 主題跑 axe | vitest＋axe |
| 視覺回歸 | 僅 README 4 張 | 219 張截圖 | 未見 | 三套演算法各拍 | Chromatic 兩套 | Chromatic | VRT＋色票 | 未見 |
| 給 AI 的文件 | AGENTS.md | AGENTS.md、Context7 | MCP、Skill＋evals、/llm | llms.txt、DESIGN.md、MCP | MCP、skills | AGENTS.md、產生的 token 表 | MCP、`$extensions.llm`、規格文件 | 分主題 llms.txt、MCP |
| 版本發佈 | 無 | 手寫 CHANGELOG | changesets＋CI 檢查 | 版本檢查腳本 | changesets＋tdiff | lerna 雙週 | changesets＋token diff | changesets |

## 共同特徵（依出現次數）

1. **偏好保存不歸元件庫（7/7）**。全部只輸出主題屬性，記住選擇交給應用程式。luca-style 是唯一自己保存偏好的。
2. **給代理的文件已成標配（7/7）**。至少有 AGENTS.md；五家另有 MCP、llms.txt 或 skills。Primer 把用途規則寫進 token 的 `$extensions.llm`，再產生規格文件。
3. **Token 有原始層（6/7）**。語意 token 指向色階或 seed，不直接寫色值。只有 shadcn 與 luca-style 只有語意一層。
4. **密度與圓角是獨立、可參數化的軸（5/7）**。手法是乘數變數或可疊加的演算法。只有 shadcn 與 Park UI 在建置時把風格一次定死。
5. **自動無障礙測試（5/7）**。都在測試中跑 axe，Primer 更是對每個 story 乘以每個主題跑一遍。
6. **視覺回歸涵蓋主題矩陣（5/7）**。逐主題或逐演算法各拍一份。
7. **巢狀主題容器（5/7）**。內層可以繼承或覆寫外層設定。
8. **沒有任何一家把設計檔當正本（0/7）**。資料或程式才是正本。有設計檔的三家（Carbon、Primer、Spectrum）都朝「token 由資料產生並匯入設計工具」以及「用 Code Connect 對應元件」的方向走。
9. **Token 用結構化格式加上驗證（4/7）**：DTCG 或 JSON Schema 格式、`$description`、parity 或涵蓋率檢查。
10. **強調色覆寫會產生一整組角色（4/7）**：Radix 12 階、Ant 演算法、Chakra colorPalette、shadcn 前景與背景成對。luca-style 只換 4 個變數。
11. **用 changesets 或 token diff 管理變更（4/7）**。

## 對既有 ADR 的證據

| ADR | 證據 | 判讀 |
|---|---|---|
| 0001 一個專案只選一套風格套系 | 正面：shadcn 與 Park UI 都是 init 時選一次。反面：Radix、Ant、Spectrum 把密度與圓角做成獨立軸 | 「每專案選一次」有支持；「密度與外形綁死在套系」缺乏支持。調和做法是把套系改成「一組軸的具名預設值」 |
| 0002 語意狀態色與業務資料色分離 | Carbon、Primer、shadcn、Spectrum 都把資料視覺化色與狀態色分開，沒有反例 | 強化 |
| 0003 `.fig` 為正本、母版雙份、人工同步 | 7 家都沒有以設計檔為正本；Primer 從程式單向匯出到設計工具；Spectrum 淘汰拆開的母版 | 受到明顯挑戰，特別是 token 這一段 |

## 本專案已領先的地方

- Token 來自單一 JSON，加上產生器與對比測試。Radix 與 shadcn 都沒有這一層。
- 已經有 ADR 與 decision-log。七家中只有 Primer、Carbon、Spectrum 有類似的治理。
- 語意狀態色與業務資料色的分離比 Radix、shadcn 嚴謹。
- 設計檔有核對腳本。Chakra 與 Ant 有設計檔卻沒有任何核對。
