# 設計稿工具改用自架 Penpot

Blocked by: none

## Why

元件庫設計檔在 OpenPencil 編輯到記憶體累積到一定程度就當機，縮小檔案（ADR 0007）也沒有解決，影響代理與人工的編輯。決定改用自架 Penpot，但 Penpot 能否穩定、能否表達 `Suite x Mode`，要先經試點證實才切換（ADR 0008，Proposed）。

## Scope

兩階段。階段一是試點，用 Penpot 暫存檔驗證穩定度與模型能否表達。階段二只在試點全部通過後進行：把元件庫設計檔、設計變數匯入管道、驗證與文件從 OpenPencil `.fig` 搬到 Penpot。

## Promises

沿用 `PR-FILE` 編號，最後已發出 PR-FILE-19。標註「修訂」的是既有承諾，編號與位置不變，只在階段二落地時改文字。

### 階段一：試點

PR-FILE-20 — 在 Penpot 暫存檔建立設計變數與 `C/Button/Primary`、`C/State/Loading`、`C/Nav/Mobile` 三個母版後，以 token theme 切換 `Suite x Mode` 的四種組合與 `Device` 的三種尺寸，三個母版解析出的色彩與 `docs/mockup/themes/variables.json` 一致。
PR-FILE-21 — 單一連續 MCP 工作階段至少 500 次寫入呼叫，加上至少 1 小時的手動編輯，全程不當機。 — retired：使用者決定不做長時間編輯的壓力測試（2026-10-30），穩定度不在試點驗收內。
PR-FILE-22 — 試點期間至少取樣 6 次瀏覽器分頁記憶體（起點、每 100 次寫入、終點），數據記錄在 `docs/delivery-verification.md`，並由使用者判定記憶體是否趨於平穩而非隨編輯次數線性成長。 — retired：隨 PR-FILE-21 一併不做（2026-10-30）。
PR-FILE-23 — 試點檔匯出的 `.penpot` 能由腳本離線解析出母版名稱與數量。
PR-FILE-24 — 試點仍有效的兩項（PR-FILE-20、23）逐項通過與否與實測數字記錄在 `docs/delivery-verification.md`；任一項未通過就停止，不進入階段二，並重新討論（ADR 0008）。

### 階段二：切換（僅在 PR-FILE-24 全部通過後）

PR-FILE-25 — 建置輸出一份 Penpot 可匯入的 token JSON 到 `docs/mockup/themes/`，涵蓋四種 `Suite x Mode` 組合與三種 `Device` 尺寸，值與 `packages/tokens/src` 的 DTCG 來源一致；離線測試在任何不一致時失敗。
PR-FILE-18（修訂）— 元件庫設計檔只有一份，是 repo 內的 Penpot 匯出檔，內容是設計變數與 23 個母版（含 `C/Select/Open`），以 token theme 切換套系與明暗；母版的填色、描邊、字型、圓角綁定設計變數；沒有頁面 frame。
PR-FILE-16（修訂）— 程式產生的設計變數匯入元件庫設計檔後，每種「套系 × 明暗」組合的值都與程式一致。
PR-FILE-26 — 元件庫設計檔的 23 個母版名稱與現有 `luca-style-library.fig` 相同，沒有遺漏或新增。
PR-FILE-27 — 若 PR-FILE-23 通過，離線腳本讀取匯出檔檢查母版名稱、數量與變數綁定，在任何差異時回報非零結束碼並列出差異，且納入測試或 CI；否則 token JSON 仍離線檢查，母版改動時經 MCP 檢查並記在 PR。
PR-FILE-06（修訂）— `docs/delivery-verification.md` 記錄 Penpot 版設計檔的檢查指令與結果，並記錄人眼抽查結果。
PR-FILE-07（修訂）— 專案文件與程式註解不再把 `.fig`、`.pen` 或 OpenPencil 當作設計稿工具，改指向 Penpot 版元件庫設計檔；歷史記錄（ADR、decision-log、delivery-verification 的過往章節）除外。
PR-FILE-08（修訂）— 工作樹中不存在 `docs/mockup/luca-style-library.fig`、`components.fig`、`components.pen`。
PR-FILE-28 — `scripts/design/` 的 OpenPencil 腳本與測試、`tests/fig-variables.spec.ts` 已刪除，`package.json` 與 CI 設定不再呼叫 `openpencil`。
PR-FILE-19（修訂）— 使用端複製元件庫設計檔並匯入自己的強調色後，母版顯示該強調色；`docs/consumer-guide.md` 記錄此步驟，以及 luca-style 更新後如何重新匯入設計變數。
PR-FILE-29 — `docs/` 下有 Penpot 自架說明，列出所用 Penpot 版本、啟動步驟與 MCP 外掛安裝方式；repo 內沒有含密鑰的設定檔。
PR-FILE-30 — `docs/consumer-guide.md` 與 `docs/adoption-prompt.md` 的設計稿起點指向 Penpot 版元件庫設計檔。
PR-FILE-31 — 落地的同一個變更改寫 GLOSSARY 的 `元件庫設計檔`、`畫布頁`、`設計變數` 三條，詞彙表不再描述 OpenPencil 專有概念。
PR-FILE-09（修訂）— ADR 0008 的狀態為 `Accepted`；ADR 0003 的狀態列註明工具選擇已被 0008 取代。

## Out of scope

- `automated_trading` 與 `badminton` 各自的設計稿，兩者不使用 luca-style 的設計檔。
- `@luca-style/tokens` 與 `@luca-style/react` 的公開輸出，不因換設計工具而改。
- Penpot 雲端版；已選擇自架。
- 讓程式重新產生母版的腳本；母版正本在設計檔，避免兩份正本（ADR 0008）。
- 同步使用端既有的舊設計稿複本，沿用 2026-10-28 的「暫不做」。
- 逐像素視覺比對；視覺檢查仍是人工抽查。
- 試點失敗後的備案；依 PR-FILE-24 重新討論，不預設退回 OpenPencil。

## Decisions

- 改用自架 Penpot，repo 放匯出檔當正本，使用端複製：ADR 0008（拒絕：留在 OpenPencil 補救、Penpot 雲端、只放連結、`.fig` 唯讀備份）。
- 設計變數維持 DTCG 為正本，只換匯入管道：ADR 0004 原則不變。拒絕經 MCP 寫入的腳本，因為它會跟著 Penpot API 版本變動。
- 母版用一次性腳本重建，腳本不留 repo：拒絕常駐產生器。
- OpenPencil 產物在 Penpot 版落地的同一個 PR 刪除：拒絕並存一段時間，沿用 ADR 0003 對 `.pen` 的先例。
- 驗證程度等試點結果決定（PR-FILE-27）。
- 自架設定只以文件放進 repo。
- GLOSSARY 等落地時一併改，不先改：詞彙表只寫現行為真。

## Open questions

- 試點結論已記錄在 `docs/delivery-verification.md` 的「Penpot 試點結論」：PR-FILE-20、23 通過，PR-FILE-21、22 retired。陰影「關閉」是否可接受、匯出檔是否改提交文字 dump 兩項待使用者決定，階段二的票等這兩項決定後再切。
- Penpot 是否比 OpenPencil 穩定沒有驗證：長時間編輯的壓力測試（PR-FILE-21、22）已由使用者決定不做。這是 ADR 0008 立論的原因（記憶體累積後當機），切換後若在 Penpot 也遇到同樣的當機，要重新評估。
- 使用端匯入強調色：`scripts/design/import-accent.js` 靠 OpenPencil 離線 CLI，Penpot 沒有等價路徑。要改為產生強調色 token JSON 讓使用端匯入，還是別的做法，由階段二設計前確認，並影響 PR-FILE-19 的文字。
- 現有「節點數低於 10,000」的限制來自 OpenPencil MCP，PR-FILE-18 修訂時已拿掉；Penpot 是否需要類似上限，等試點觀察。
- token theme 是否能表達 `Suite x Mode`，且不重演 ISSUE-015（只切一組就漏掉其他）；兩個 theme 群組（`Suite x Mode`、`Device`）各自啟用一個即可，是否成立要試點證實。
  - 試點結果（ISSUE-018、019）：三個母版在 Suite x Mode 四種與 Device 三種共 12 組切換後，解析色彩與 `variables.json` 全等，沒有漏掉其中一組；兩個群組各啟用一個 theme 可行。PR-FILE-20 的解析值比對到此完成；載入圖片是替身，使用者人眼抽查尚未做。
- `.fig` 只存預設模式的項目（hug 版面尺寸、陰影開關、載入圖片透明度）在 Penpot 是否能跟著 theme 切換：ISSUE-019 試點已觀察，三項都能跟著切換，但各有限制，細節與數據見 `docs/delivery-verification.md` 的 Penpot 試點章節。
  - hug 版面尺寸：會。`C/Nav/Mobile` 高度隨 `fs-section` 變（Desktop 53、Tablet 51、Mobile 48），`C/State/Loading` 內距綁 `card-padding` 後高度 Vibrant 181、Professional 173。只驗證字級與內距兩種綁定。
  - 陰影開關：值會跟著變，但 Penpot 沒有「關」，只能用零偏移、零模糊、透明度 0 的陰影代替，形狀上仍有一筆陰影。`elevation-enabled` 是布林、現在不輸出，正式做法要新增 shadow token。待使用者確認這樣是否可接受。
  - 載入圖片透明度：會，`C/State/Loading` 每個 Suite x Mode 恰好顯示四張中的一張。做法是四個疊在一起的矩形各綁一個不透明度 token（Penpot 的不透明度綁形狀，不能綁填色的第幾層）。載入圖片在暫存檔是純色替身，真實圖片上傳失敗（`http error`），尚未證實。
- `font-zh` 的 `fontFamilies` 綁定：`applyToken(token, ['fontFamilies'])` 一律失敗，不傳 `properties` 即可（綁成 `fontFamily`）；ISSUE-018 遺留的 `font-zh` 已補綁。要不要把這個寫法放進階段二的重建指引，待定。
  - 匯出檔裡儲存的綁定鍵是 `fontFamily`（不是 `fontFamilies`），離線解析要用這個鍵；其餘儲存鍵與 API 屬性名也不同（圓角 `r1`～`r4`、內距 `p1`～`p4`、描邊色 `strokeColor`），見離線解析章節。
- 匯出檔的 repo 路徑、檔名，以及二進位 diff 的審查方式：ISSUE-020 已匯出一份 34 KB 的試點檔（見 `docs/delivery-verification.md` 的離線解析章節），zip 內有時間戳、隨機縮圖 id、雜湊序鍵序，推測同內容兩次匯出位元組不同（只有一次匯出，未實測；`File.export` 失敗無法重匯）。進版控要有規格化的文字展開才能審查與比對；路徑與檔名待階段二訂。PR-FILE-23 已能離線列出母版名稱與數量；母版轉成元件後的匯出表示未驗證（無法重匯）。
- 所用 Penpot 版本是否固定，等自架環境建好後記錄。
