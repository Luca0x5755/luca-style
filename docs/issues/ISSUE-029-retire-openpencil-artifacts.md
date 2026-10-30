# 退場 OpenPencil 產物

Blocked by: ISSUE-027

## Done when

- 工作樹沒有 `docs/mockup/luca-style-library.fig`、`scripts/design/` 的 OpenPencil 腳本與測試、`tests/fig-variables.spec.ts`（PR-FILE-08、28）。
- `package.json` 與 CI 設定不再呼叫 `openpencil`。
- 專案文件與程式註解不再把 `.fig` 或 OpenPencil 當設計稿工具，歷史記錄（ADR、decision-log、`docs/delivery-verification.md` 的過往章節）除外（PR-FILE-07）。
- `docs/delivery-verification.md` 記錄 Penpot 版設計檔的檢查指令與結果（PR-FILE-06）。

## Context

OpenPencil 提及約 230 處，多數在 `docs/delivery-verification.md` 的歷史章節，那些保留。ADR 0003 的先例：不留備份，git 歷史保存。

## Blocked by

ISSUE-027

## Notes

- `docs/mockup/themes/variables.json` 與 `bindings.json` 現在是 ISSUE-027 檢查的比對基準；刪除前確認有沒有被取代。
- 刪 `.fig` 之前先確認 Penpot 檔與 dump 已提交。
- ISSUE-027 已提交 `docs/mockup/luca-style-library.penpot` 與 `docs/mockup/luca-style-library.dump.json`。`scripts/design/check-penpot.mjs` 讀 `docs/mockup/themes/bindings.json`、`variables.json`、`penpot-tokens.json` 當比對基準，三份檔案不能隨 `.fig` 一起刪；`penpot-dump.test.mjs` 的守門（`exportViolations`）只放行上述 `.penpot`，並且對 `.fig` 設有例外，`.fig` 刪掉後可一併移除該例外。
- `scripts/design/*.test.js` 依賴 openpencil，不在 `npm test` 內；`tests/penpot-library.spec.ts` 只跑 `*.test.mjs`。
