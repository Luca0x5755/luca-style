# 補上全部組合的截圖和 axe

Blocked by: ISSUE-003

## Done when

- 產品範本的 48 種組合（4 狀態 × 2 風格套系 × 2 明暗模式 × 寬度 1280、834、390）都有截圖基準，畫面不符時測試失敗。
- 同樣的組合都跑 axe，沒有 serious 或 critical 等級的違規。
- `npm run test:visual` 和 CI 的 visual job 都有跑到這些截圖；`npm test` 有跑到這些 axe 檢查。
- PR-REVIEW-01 仍然成立：正式建置與 Pages 輸出不含總覽頁。

## Context

兌現 PR-REVIEW-08、09，規格見 `docs/issues/ISSUE-001-state-overview-page.md`。專案負責人只審預設組合再抽查，其餘組合要靠這些檢查把關。

## Notes

- 現有截圖和 axe 都跑在正式建置的預覽（port 4173）上，那裡沒有這一頁，所以要另開開發伺服器或專用建置。專用建置不能影響 `npm run build` 的輸出。
- 不要把總覽頁加進 `tests/visual-matrix.ts` 的 `visualPages`，那份清單的來源是路由表，`tests/visual-config.spec.ts` 也會比對。
- 基準只在 Linux Docker 映像內產生（`npm run update:visual`，見 `scripts/visual-docker.mjs`），不要在 Windows 產生。
- 視覺專案的伺服器設定在 `playwright.config.ts`，CI 在 `.github/workflows/pages.yml`。
- 這會新增 48 張基準圖，PR 要說明。
