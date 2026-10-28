# 由 DTCG 產生設計檔變數，apply-variables.js 改讀產生的資料

Blocked by: ISSUE-002

## Done when

- `npm run generate` 另外產生一份設計檔變數資料，內容是程式變數與 `docs/mockup/themes/variables.json` 現有 48 個變數的聯集。
- `scripts/design/apply-variables.js` 改讀這份產生的資料；`docs/mockup/themes/variables.json` 不再人工維護（刪除，或改成產生物並在檔頭註明）。
- 對兩份套系設計檔執行 `apply-variables.js --check`，每種「套系 × 明暗」組合的值都與程式輸出一致。（PR-FILE-16）
- 設計檔腳本的既有測試全部通過（`scripts/design/*.test.js`）。

## Context

ADR 0004 定了設計變數以程式中的 DTCG 為正本，寫入設計檔用離線腳本 `apply-variables.js`，變數集合取兩邊聯集。這張先讓現有兩份套系設計檔吃到 DTCG 的值；合併成一份元件庫是 ISSUE-004。見 [ADR 0004](../adr/0004-design-variables-sourced-from-dtcg-tokens-and-imported-into-fig.md)、[架構 §3.4](../03_architecture_design.md)、[前端規格 §5.5.2](../05_frontend_spec.md)。

## Notes

- 只在設計檔有、程式沒有的變數，要補進 DTCG 原始檔（帶 `$description`），不能只留在產生的資料裡，否則正本又變兩份。
- 寫入設計檔用 `openpencil eval <file> --stdin -w`；OpenPencil MCP 的根目錄不是本 repo，開不到這裡的檔案。
- 不採用 `import_design_tokens`：它需要開著 OpenPencil App。
