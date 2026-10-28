# 樣張每頁 × 套系 × 明暗跑 axe 無障礙檢查

Blocked by: none

## Done when

- 加入 `@axe-core/playwright`。
- 一個 Playwright 測試對樣張每一頁 × 兩種風格套系 × 兩種明暗模式跑 axe。（PR-STYLE-41）
- 有 serious 或 critical 等級的違規時測試失敗；minor、moderate 只列在測試報告（附件或 console），不讓測試失敗。（PR-STYLE-41）
- 目前樣張若有 serious／critical 違規，在本議題修掉；修不掉的寫進 Notes 並說明原因。
- 測試在 CI（`.github/workflows/pages.yml` 的 Playwright 步驟）執行。

## Context

對標研究發現 luca-style 沒有自動的無障礙檢查。門檻已決定只擋 serious 和 critical（2026-10-28）：先擋住真正影響使用的問題，較輕微的列出來之後再處理。見 [ISSUE-001](ISSUE-001-design-system-0-2-0.md)、[架構 §3.1](../03_architecture_design.md) 的「品質檢查」列、[前端規格 §5.2 路由](../05_frontend_spec.md)。

## Notes

- 頁面清單從路由表或樣張的路由設定取得，不要手寫，避免新增頁面時漏掉。
- 本議題只檢查每頁的 Success 狀態；Loading／Empty／Error 狀態留給之後。
- 這張不依賴其他議題，現在就能做；後續議題改了畫面，這個測試會一起把關。
