# 將設計稿依風格套系拆成兩個 `.fig` 套系設計檔

Blocked by: none

## Why

設計稿原本是單一 `components.pen`，由 Pencil 編輯。你決定改用 OpenPencil，讓代理可以透過 MCP 自動新增、修改、儲存與刪除，不必你手動存檔。

遷移後的單一 `.fig` 約有 11,500 個節點。OpenPencil MCP 對超過 10,000 個節點的文件拒絕編輯，所以代理改不了它。解法是依風格套系拆成兩個 `.fig`，各約 5,800 個節點，並讓 `.fig` 成為設計稿正本、廢棄 `.pen`。決策與取捨見 [ADR 0003](../adr/0003-split-design-source-by-style-suite-in-fig.md)。

## Scope

- 產出 `docs/mockup/components-vibrant.fig` 與 `docs/mockup/components-professional.fig` 兩個套系設計檔。
- 兩檔各帶一份相同的 22 個母版。
- 以離線 `openpencil` 命令列工具切檔，不在 App 內大量刪除節點。
- 撰寫母版一致性比對與拆檔結構驗收兩支腳本，並納入交付驗證。
- 更新所有把 `components.pen` 當設計稿的文件與註解。
- 移除中間產物 `components.fig`，最後移除 `components.pen`。

## Promises

- PR-FILE-01 — `components-vibrant.fig` 含原設計稿全部精緻活力的頁面 frame 與元件檢視板，節點數低於 10,000，且能以 OpenPencil MCP 編輯並自動儲存。
- PR-FILE-02 — `components-professional.fig` 含原設計稿全部精緻專業的頁面 frame 與元件檢視板，節點數低於 10,000，且能以 OpenPencil MCP 編輯並自動儲存。
- PR-FILE-03 — 兩個套系設計檔的頁面 frame 合計，涵蓋原設計稿 302 個 frame 的全部名稱，沒有遺失，也沒有任何一個套系的 frame 出現在另一個套系設計檔。
- PR-FILE-04 — 每個頁面 frame 的節點數、文字內容與填色，與原設計稿一致；結構驗收腳本在不一致時回報非零結束碼並列出差異。
- PR-FILE-05 — 兩個套系設計檔的 22 個母版內容相同；比對腳本在任何差異時回報非零結束碼並列出母版名稱。
- PR-FILE-06 — `docs/delivery-verification.md` 記錄母版比對與結構驗收的執行指令與結果，並記錄每頁各 2 個代表 frame 的人眼抽查結果。
- PR-FILE-07 — 專案文件與程式註解不再把 `components.pen` 或「唯一設計檔」當作設計稿，改指向兩個套系設計檔。
- PR-FILE-08 — 工作樹中不存在 `docs/mockup/components.fig` 與 `docs/mockup/components.pen`；`.pen` 只在 PR-FILE-03 至 PR-FILE-06 驗收通過後才刪除。
- PR-FILE-09 — ADR 0003 在本議題落地時由 `Proposed` 改為 `Accepted`。

## Out of scope

- 依頁面再拆檔。留待之後另行研究，目的是評估其他專案頁面很多時的餘裕。
- 改變任何設計內容、母版樣式或色彩。這次只搬移與拆分。
- 跨檔母版庫（OpenPencil library）。它依修訂版手動更新，無法連動，ADR 0003 已否決。
- Pencil 與 OpenPencil 的逐像素比對。兩者渲染器不同，不可靠；視覺 QA 維持目視。
- 修改 OpenPencil 或 `@open-pencil/cli` 原始碼。

## Decisions

- 依風格套系拆成兩檔，而不是維持單檔、改用母版庫，或先依頁面拆。見 ADR 0003。
- 檔名為 `components-vibrant.fig` 與 `components-professional.fig`：保留 `components` 前綴，與現有「元件庫」稱呼一致，也便於以 grep 找出舊引用。否決 `vibrant.fig` 與 `professional.fig`。
- 兩檔各帶一份母版，以腳本比對維持一致。否決人工核對，以及指定一檔為正本、另一檔由腳本覆蓋。
- 驗收採結構比對加人眼抽查，不做完整肉眼比對全部 frame。
- 單檔 `components.fig` 拆完即刪除。
- `.pen` 在同一功能分支內、驗收通過後的最後一步從工作樹刪除，由 git 歷史保留。否決保留凍結期與永久封存。

- 無套系的共用物件（`Library guide` 頁、`00 / Canvas directory` 目錄與兩個文字節點）兩檔各放一份，與母版同樣處理，並納入 PR-FILE-05 的比對。
- 原檔既有的 `Internal Only Canvas` 頁與套系無關，兩個套系設計檔都不放。
- `openpencil` 在 Windows 需要的兩處本機修補（位於全域 npm 安裝目錄，重新安裝會還原）寫在切檔工作的 Notes，不另寫文件。

## Open questions

無。

## 拆票

ISSUE-002 至 ISSUE-006，依賴關係：002 → 003、004、005 → 006。
