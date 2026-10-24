# 從 `.pen` 擷取主題變數定義、綁定表與解析後基準

## Done when

- `docs/mockup/themes/variables.json` 記錄 `.pen` 的全部 48 個變數：名稱、型別，以及在每個主題組合（`mode`、`suite`、`device`）下的值。
- `docs/mockup/themes/bindings.json` 記錄每個被綁定的屬性：頁面 frame 名稱、節點在該 frame 內的索引路徑、屬性（fill、stroke、strokeWidth、fontFamily、fontSize、gap、padding、cornerRadius、effect、文字填色）、變數名稱。涵蓋 `.pen` 內約 7,500 處變數引用，以及 22 個母版內的引用。
- `docs/mockup/themes/resolved.json` 記錄每個頁面 frame 在它自己的主題下，每個被綁定屬性解析後的實際值，作為 ISSUE-010 的比對基準。`.pen` 在 ISSUE-006 之後會被刪除，所以這個基準必須現在存下來。
- 擷取腳本或指令步驟已寫入 `docs/delivery-verification.md`，別人可以重做。
- 抽樣核對：任選 5 個 Dark frame 與 5 個 Light frame，`resolved.json` 的值與 Pencil 畫面上看到的一致，結果寫進該文件。
- 檔案大小與筆數已記錄；若單檔超過 5 MB，改為每個套系一份。

## Context

規格見 [ISSUE-001](ISSUE-001-split-design-source-by-suite.md)，對應 PR-FILE-10 的資料來源。轉檔時 `.pen` 的變數被攤平成預設主題（Vibrant／Light）的固定顏色，所以 `.fig` 裡沒有變數、Dark 頁面和 Light 頁面完全相同。`.pen` 是目前唯一保有正確資料的地方。

## Blocked by

nothing

## Notes

- 只能透過 `pencil` MCP 讀 `.pen`（檔案加密，不可用 Read 或 Grep）。先讀 `read_skill` 的 `execute.md`，使用 `execute` 的 `GetVariables()`、`Get` 訪客函式與 `resolveVariables: true`，用 `Print` 輸出。
- Pencil 不能寫檔，資料要經對話內容轉成 JSON 再寫入。分批處理（每次一個 frame 群組），避免單次輸出過大。
- `.pen` 的節點是未展開的實例（約 7,000 個），`.fig` 是展開後的（約 11,500 個）。索引路徑要能在兩邊對得上；先對一個 frame 試做對應，若對不上，在 Notes 寫明規則再繼續。這是本票最大的風險。
- 11 個變數同時依 `mode` 與 `suite` 決定值；`device` 軸只有 3 個變數。
- 母版的綁定要另外存，因為母版內的綁定會被實例繼承。
- 不要修改 `.pen`。
