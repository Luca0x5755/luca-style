# 兩份套系設計檔合併為一份元件庫設計檔

Blocked by: ISSUE-003

## Done when

- `docs/mockup/luca-style-library.fig` 是唯一的設計檔；`components-vibrant.fig` 與 `components-professional.fig` 已刪除。
- 檔案內只有設計變數與 23 個母版（含 `C/Select/Open`），沒有頁面 frame，節點數低於 10,000。（PR-FILE-18）
- 設計變數有「套系」「明暗」兩組模式；切換套系與明暗時，母版的填色、描邊、字型、圓角都跟著變（綁定設計變數）。（PR-FILE-18）
- 四種「套系 × 明暗」組合各匯出一張母版總覽 PNG，人工核對與合併前的兩份檔案一致。
- 只為頁面或兩檔比對存在的腳本與測試已刪除（`paginate-fig`、`relayout-fig`、`verify-split`、`pages.js`、`layout-snippets.js` 等，以實際用途為準）；留下的腳本改指向新檔且測試通過。
- `GLOSSARY.md` 的「套系設計檔」「畫布頁」依 ADR 0007 改寫。
- `docs/adoption-prompt.md` 等仍指向兩份套系設計檔或頁面 frame 的說明，改指向元件庫設計檔與樣張網站（`docs/delivery-verification.md` 的歷史紀錄不改）。

## Context

ADR 0007 決定設計檔只留一份元件庫：使用端專案都不用 luca-style 的頁面 frame，只需要母版和變數；頁面範本以樣張網站為準。見 [ADR 0007](../adr/0007-keep-one-component-library-design-file-without-pages.md)（修訂 ADR 0003）、[前端規格 §5.5、§5.5.1](../05_frontend_spec.md)、[架構 §3.1、§3.4](../03_architecture_design.md)。

## Notes

- **合併前提**：兩份檔案的母版只能在「綁定的設計變數」上不同。先寫腳本逐一比對兩份母版的結構（節點樹、版面、未綁定的數值）；有結構差異就停下，回報差異清單，保留兩檔，不要硬合。
- 目前已知差異：專業套系的圓角、密度數值不同，但這些應該都已綁定變數；確認未綁定的原始值也不影響結果。
- 「套系」模式要能表示密度與外形的套系預設值（ISSUE-008 會加等級；這裡先用套系預設即可）。
- `check-masters.js` 原本比對兩份檔案，合併後改成檢查單一檔案的 23 個母版存在且已綁定。
- 改檔用離線 `openpencil eval`，匯出用 `openpencil export --node <id> -s 2`。
