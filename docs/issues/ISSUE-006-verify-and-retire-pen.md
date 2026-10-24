# 驗收拆檔並廢棄 `.pen`

## Done when

- ISSUE-003 與 ISSUE-004 的腳本對最終的兩個套系設計檔都通過（結束碼 0）。
- 每頁（Home、Foundations、Components、Product、Intro、NotFound）各 2 個代表 frame 已人眼抽查，結果寫入 `docs/delivery-verification.md`，不聲稱做過像素比對。
- `docs/mockup/components.fig` 與 `docs/mockup/components.pen` 已用 `git rm` 刪除（先確認 `components.fig` 是否曾被追蹤；若沒有就直接刪檔）。`.pen` 是最後一個被刪的檔案。
- `docs/adr/0003-split-design-source-by-style-suite-in-fig.md` 的 `Status` 改為 `Accepted`。
- `ISSUE-001` 至 `ISSUE-006` 中持續有效的內容已移入正式文件，議題檔以 `git rm` 刪除，隨本票提交。
- `test-results/probe/` 的試做檔已清除，OpenPencil 中遺留的試做分頁已關閉（`unsaved: "discard"`）。

## Context

規格見 [ISSUE-001](ISSUE-001-split-design-source-by-suite.md)，對應 PR-FILE-06、PR-FILE-08、PR-FILE-09。這張票是結案：只有確認前面全部通過後才刪除原檔，因為刪除後無法再當比對基準，只能靠 git 歷史找回 `.pen`。

## Blocked by

ISSUE-003, ISSUE-004, ISSUE-005

## Notes

- 抽查需要人看畫面：用 OpenPencil 的 `export_image` 匯出代表 frame，請使用者目視確認，不要自行宣稱通過。
- 持續有效的 promise（`PR-FILE-*`）移入 `docs/capabilities/design-system.md`，與 `PR-STYLE-*` 並列，並保持 ID 不變。
- 提交前再搜尋一次 `components.pen`，確認沒有遺漏的引用。
