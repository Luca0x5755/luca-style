# 建立只差確認就能發佈的流程

## Done when

- changesets 已導入，兩個套件版本一致（`PR-ADOPT-09`）。
- 第一個 changeset 把版本帶到 0.3.0，並附不相容變更的升級說明，包括高度變化（Button、Select、TextField 單行時等於 `control-height`，不再是 50px）、Select 長值改為換行而非省略號、TextField 的輸入框（`.luca-input`）改為 border-box、Button 在 flex 列中不再收縮、導覽連結的樣式改由 `.luca-navigation-link`、`.luca-brand` 選取，特異度降為 (0,1,0)（原本是 `.luca-navigation a`、`.luca-navigation .luca-brand`，專案依舊選擇器的特異度覆寫的樣式要改寫）。說明另列新增的 `Navigation` 的 `renderLink` 與 `Button` 的 `render`（`ButtonLinkProps`）。
- CI 能對 0.3.0 跑完發佈的試跑，工作流程設定好來源證明，權杖只從 CI 機密讀取（`PR-ADOPT-10`）。
- 真正發佈的工作只能手動觸發。`evals/results/copy-vs-npm.json` 不存在、`copyBetter` 不是 `false`，或沒有擁有者的確認時，工作都會失敗（`PR-ADOPT-11`）。
- 有測試用假的結論檔驗證上面三種失敗情況。
- 承諾已移入 `docs/capabilities/design-system.md`。

## Context

規格見 `docs/issues/ISSUE-001-npm-publish-readiness.md`。這張票不做真正的發佈，發佈在下一份規格。決策紀錄已定：首次發佈用 0.3.0，版本號不能重複使用，0.x 期間不相容變更升次版號。

## Blocked by

Blocked by: ISSUE-004, ISSUE-005, ISSUE-006

## Notes

- `tests/deploy-workflow.spec.ts` 是測工作流程的現成範例。
- 來源證明需要 `id-token: write`。
- 確認機制用 GitHub 環境的必要審核者。
- `@luca-style` 組織和權杖由擁有者建立。不要嘗試建立，不要開啟或寫入任何金鑰，repo 只寫機密的名稱。
- 不要執行真正的 `npm publish`，也不要推版本標籤。
- `evals/results/copy-vs-npm.json` 由 ISSUE-014 產生，格式至少有布林欄位 `copyBetter`。
