# 文件、詞彙表與 ADR 收尾

Blocked by: ISSUE-028, ISSUE-029

## Done when

- `docs/` 有 Penpot 自架說明：Penpot 版本、啟動步驟、MCP 外掛安裝；沒有含密鑰的設定檔（PR-FILE-29）。
- `docs/consumer-guide.md` 與 `docs/adoption-prompt.md` 的設計稿起點指向 Penpot 檔，含強調色匯入步驟（PR-FILE-30、19）。
- GLOSSARY 的 `元件庫設計檔`、`畫布頁`、`設計變數` 改寫，不再有 OpenPencil 專有概念（PR-FILE-31）。
- ADR 0008 改為 `Accepted`；ADR 0003 狀態列註明工具選擇已被取代（PR-FILE-09）。
- 規格 ISSUE-017 的承諾移進 `docs/capabilities/design-system.md` 後，ISSUE-017 刪除。

## Context

GLOSSARY 在 Penpot 版落地的同一個變更才改寫（ADR 0008 Consequences）。

## Blocked by

ISSUE-028, ISSUE-029

## Notes

- 試點用的是 Penpot 2.18.5-RC1；是否固定版本由這張票決定並記錄。
- 這是最後一張，完成後 `docs/issues/` 應為空，CI 的 `issues-check` 才會通過。
- 強調色匯入步驟需要的說明文字（來自 ISSUE-028，做法仍待使用者確認）：先在 luca-style 檢出執行 `npm ci`、`npm run generate`；`node scripts/design/penpot-accent.mjs --accent '{"light":"#B5179E"}' --out accent.tokens.json`（`--accent` 與 `ThemeProvider` 的 `AccentInput` 相同，只有 `light` 必填）；在 Penpot 的 Tokens 面板匯入該 JSON，會多出 4 個 `Project Accent/*` set 與 4 個 Suite x Mode theme（含 Base、既有 Suite x Mode set、對應 Project Accent set）。匯入後切換一次 theme 讓畫面套用。若匯入取代了整個 token 庫，改為手動建 4 個 set 貼入 6 個 token，並在 4 個 Suite x Mode theme 各啟用對應的 `Project Accent/*` set（排序要在 Suite x Mode 之後；匯入後順序未驗證，請確認）。要還原強調色：從 theme 取消並刪除 4 個 Project Accent set。實際匯入行為未驗證，寫文件前請使用者在介面實測一次。
- 檢查指令（ISSUE-027）：`npm run check:penpot`（母版名稱、綁定、其他 theme 的解析值，再比對已提交的 dump）。更新設計檔的流程：使用者在 Penpot 內先確認檔名是 `luca-style-library`，匯出覆蓋 `docs/mockup/luca-style-library.penpot`，執行 `node scripts/design/penpot-dump.mjs docs/mockup/luca-style-library.penpot` 重新產生 `docs/mockup/luca-style-library.dump.json`，再跑 `npm run check:penpot`；兩個檔案一起提交。匯出檔約 353 KB（含縮圖 PNG），dump 約 376 KB，匯出檔是二進位，審查看 dump 的差異。
- ISSUE-029 留下的懸空引用（本票處理）：`docs/consumer-guide.md` 仍以 OpenPencil 為設計稿工具（約 65 行起的設計稿段落、76 行的「人工同步順序」指向已刪除的 `scripts/design/check-masters.js` 與 `apply-variables.js`、`#openpencil-與程式…` 錨點，`docs/delivery-verification.md` 253 行連到該錨點，改標題時一併處理）；`docs/adoption-prompt.md`、`GLOSSARY.md` 同樣仍寫 OpenPencil／`.fig`。ISSUE-029 把 `--fig` 旗標改名 `--variables`，並已把 `docs/capabilities/design-system.md` 的 PR-FILE-06、07、08 改成 ISSUE-017 的修訂文字；PR-FILE-28、29、25～27、32、33 等新承諾仍待本票搬入。
