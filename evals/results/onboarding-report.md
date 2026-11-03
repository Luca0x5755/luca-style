# 全新代理只靠文件接入實測（PR-ADOPT-06）

由 `node evals/report.mjs` 從 `evals/results/*-onboarding-*.json` 產生，不要手改；「卡在哪裡」與「指南修改」是人讀紀錄後的人工歸納（結果檔的 `manual`），其餘欄位由程式從結果檔機械產生。

指南版本：`1bb6443`（內容 sha256 `c7413cd3ec8c`）。這 3 次都用這個版本；之後修過指南，這些結果照舊保留，不重跑。

題目是 `evals/tasks/onboarding.md`，起始專案是 `evals/starters/onboarding`（乾淨的 Tailwind v3 專案）。代理只看得到 `docs/consumer-guide.md` 與 `packs/` 的兩個打包檔；題目只說明 npm 安裝指令改用打包檔，沒有其他提示。模型、effort、隔離旗標與 ISSUE-011 相同。

| 結果檔 | 檢查 | outcome | 卡在哪裡（人工歸納） | 費用 | 時間 | 指南 sha |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-02-19-29-59-onboarding-luca-guide.json | 通過 | passed | 沒卡住 | $0.16 | 0.8 分 | 1bb6443 |
| 2026-11-02-19-31-25-onboarding-luca-guide.json | 通過 | passed | 沒卡住 | $0.17 | 0.9 分 | 1bb6443 |
| 2026-11-02-19-32-44-onboarding-luca-guide.json | 沒通過 | failed-grade | 接線都對（preset、CSS 順序、字體、ThemeProvider），沒有卡住；但略過了 tailwind-merge（它判斷「頁面用不到」），評分的探針頁用 twMerge，所以建置在評分時失敗。 | $0.16 | 0.7 分 | 1bb6443 |

## 結論

- 沒通過 1 / 3 次（failCount = runs.filter(r => !r.grade?.pass).length；逾時、超出預算、輸出不是 JSON、隔離失敗都算沒通過）。
- 門檻：3 次中 2 次以上沒通過就補 CLI。**CLI needed = false**
- 不需要補 CLI（決策紀錄：P1 不做 CLI，除非代理在實測中常接錯）。

「需要人介入」的定義：代理結束後，ISSUE-002 的乾淨專案檢查沒有通過（`claude -p` 執行時沒有人在場）。

## 通過代表什麼

通過證明：代理接的線（Tailwind preset、CSS 入口順序、字體、套件安裝、專案裡有用 ThemeProvider）在評分者的探針頁上有效。不證明：代理自己的頁面能用（探針頁由評分者蓋進專案，頁面與 ThemeProvider 的用法是評分者的）；也只涵蓋 Tailwind v3，不涵蓋 v4、Next、React 18 的接入。

## 沒通過的原因

- 2026-11-02-19-32-44-onboarding-luca-guide.json：檢查未通過：install；檢查失敗項目 install（npm run build 失敗：src/probes.tsx(3,23): error TS2307: Cannot find module 'tailwind-merge' or its corresponding type decla）

## 失敗原因對應的指南修改

- 2026-11-02-19-32-44-onboarding-luca-guide.json：部分是指南的問題：Tailwind v3、v4 兩節只列 `npm install tailwind-merge`，沒說它是什麼、何時需要，代理合理地略過。已在兩節補上用途與「照文件驗證接入時一定要裝」。另一部分是評分的限制：探針頁需要 tailwind-merge，題目又不給提示，所以這次的失敗反映的是文件沒說清楚，不是接線錯誤。

## 費用

- 實際合計 $0.49（預期約 $2）。
- 硬上限：3 次 × $5 = $15（每次 `--max-budget-usd 5`，逾時 45 分鐘）。
- 停止條件：任何一次撞到預算就中止整個系列；累計超過 $6 就停下回報協調者（程式在開下一次前檢查）。

## 揭露

- 隔離沿用 ISSUE-011 的旗標；路徑拒絕規則只涵蓋 Read、Edit 且從未被實際觸發。Glob、Grep、Bash 不在其內，所以改為事後判定：任何工具呼叫提到 repo 路徑、examples、llms.txt 都算隔離失敗（outcome `harness-error`、`harnessCause: isolation`），仍算進 3 次且算沒通過，不自動重跑。
- 打包的 `@luca-style/react` 隨套件附 DESIGN.md 與 llms.txt（發佈後的使用者也有）；工作區本身沒有，代理若去讀 llms.txt 會被判隔離失敗，讀 DESIGN.md 只記次數（`designMdTouched`）。
- 新結果檔已把工作區路徑換成 <workspace>、家目錄換成 <home>（反斜線、正斜線、JSON 轉義與 msys 寫法）；ISSUE-011 既有的結果沒有去識別，照舊保留。
- 樣本只有 3 次、一個題目（Tailwind v3），結論是門檻判斷，不是統計。
