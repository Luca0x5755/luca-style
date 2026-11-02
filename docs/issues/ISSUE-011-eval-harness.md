# 建立評測工具並跑通第一次

## Done when

- `evals/` 有後台與 CRUD 的題目、執行工具和評分工具。兩組拿到的題目文字相同。
- 評分工具輸出寫死顏色數、axe 的 serious 和 critical 違規數、三種寬度的水平溢出、四種狀態缺漏數、費用和時間。
- 給故意寫壞的範例專案時，評分工具能抓到上述每一項品質問題。有測試驗證。
- 「無工具」和「裝 Luca Style 並附文件」各跑通 1 次，結果存在 `evals/results/`。
- 報告寫明這兩次的費用、使用的模型和預估的 18 次基準費用。

## Context

規格見 `docs/issues/ISSUE-001-npm-publish-readiness.md`。這張票只做工具和試跑，是 `PR-EVAL-01`、`PR-EVAL-04` 的基礎，承諾由 ISSUE-013、ISSUE-014 完成時移入正式文件。

## Blocked by

Blocked by: ISSUE-002

## Notes

- 用 `claude -p --output-format json` 執行，從輸出讀費用和時間。先用 `claude --help` 確認目前的旗標。
- 固定一個模型並寫進報告，所有評測都用它。
- 代理必須在 repo 外的暫存目錄工作。個人設定、skill、記憶和 `CLAUDE.md` 都不能載入，否則「無工具」組會被污染。要實際驗證隔離有效，例如在執行紀錄裡確認沒有載入 skill。
- 「裝 Luca Style」組從打包檔安裝，文件隨套件提供。
- 題目要規定怎麼切到四種狀態，例如用網址參數，評分工具才進得去。
- 寬度沿用 `tests/visual-matrix.ts`。
- 這張票只跑 2 次。超過就是花了沒被同意的費用。
- `claude -p` 無法登入或被擋時，把票標成 STALLED，不要改用其他方式跑。
