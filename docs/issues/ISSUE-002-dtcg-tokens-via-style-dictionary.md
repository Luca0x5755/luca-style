# 設計變數改用 DTCG 原始檔，經 Style Dictionary 產生 0.1.0 相同的輸出

Blocked by: none

## Done when

- `packages/tokens/src/` 的設計變數原始檔是 DTCG 格式（`$value`、`$type`），每個變數都有 `$description`。（PR-STYLE-25）
- `npm run generate` 改由 Style Dictionary 產生 `dist/tokens.css`、`dist/tokens.json`、`dist/typography.json`。
- 三份輸出與 0.1.0 相比，既有變數的名稱、結構和值完全相同；有一個測試把新輸出和 0.1.0 的快照逐項比對。（PR-STYLE-27）
- 刪掉任一「風格套系 × 明暗模式」組合中的一個變數值，建置失敗，錯誤訊息寫出缺的變數名稱和組合。（PR-STYLE-26）
- `npm run build`、`npm test`、`npm run typecheck`、`npm run lint` 全部通過。

## Context

這是 0.2.0 升級的先導議題：先證明「DTCG → Style Dictionary → 現有輸出」這條路走得通，後面的議題（設計檔變數、強調色、密度與外形、代理文件）都接在它的輸出上。規格見 [ISSUE-001](ISSUE-001-design-system-0-2-0.md)；技術選擇見 [架構 §3.1](../03_architecture_design.md) 的「設計變數」列與 [ADR 0004](../adr/0004-design-variables-sourced-from-dtcg-tokens-and-imported-into-fig.md)；改用 Style Dictionary 的理由見 decision-log 2026-10-28。

## Notes

- 先把現有 `packages/tokens/dist/` 的三份輸出存成快照，再動產生器；快照就是 PR-STYLE-27 的驗收基準。
- 這張只換來源格式與產生器，不新增變數、不加密度與外形、不加推算色。新變數由後續議題加入。
- 自寫的 `generate.mjs` 可以退休；Style Dictionary 用自訂 format 維持現有輸出結構。
- 完整性檢查放在建置流程內（不是另一支腳本），才會讓建置失敗。
