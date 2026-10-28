# 產生給代理讀的設計變數規格文件，並提供 llms.txt 與 DESIGN.md

Blocked by: ISSUE-002, ISSUE-006, ISSUE-007, ISSUE-008, ISSUE-010

## Done when

- `npm run generate` 會產生一份設計變數規格文件（Markdown），列出每個變數在每種「套系 × 明暗」組合下的值和用途（取自 `$description`）。（PR-STYLE-28）
- repo 根目錄有 `llms.txt` 與 `DESIGN.md`，說明套件、主題軸（套系、明暗、密度、外形、強調色）、元件與設計變數的用法，並連到上面的規格文件。（PR-STYLE-43）
- 文件內容與實際 API 一致：`DESIGN.md` 裡的程式範例能通過 typecheck（例如放進測試或範例檔編譯）。
- 兩份檔案隨 `@luca-style/react` 或 tokens 套件發布（`files` 欄位包含），使用端安裝後讀得到。

## Context

對標研究中多數設計系統提供給代理讀的文件；決定這次就做 `llms.txt` 與 `DESIGN.md`（decision-log 2026-10-28）。規格文件由 DTCG 原始檔產生，所以要等 ISSUE-002；主題軸與元件的說明要等相關議題完成，避免寫完又改。見 [ISSUE-001](ISSUE-001-design-system-0-2-0.md)、[架構 §3.1、§3.3](../03_architecture_design.md)。

## Notes

- 規格文件是產生物，不要手改；在檔頭註明由哪支腳本產生。
- `DESIGN.md` 寫給代理：先講決策規則（何時用哪個套系、強調色不改語意狀態色、業務資料色另訂），再講 API。使用 `GLOSSARY.md` 的術語。
