# 基準評測報告（PR-EVAL-04）

由 `node evals/report.mjs` 從 `evals/results/*.json` 中 `series` 為 `baseline` 的檔產生，不要手改。ISSUE-011 的試跑結果（`report.md`）不在這 18 次裡。

3 個場景（後台與 CRUD＝`evals/tasks/crud.md`、資料儀表板與監控＝`evals/tasks/dashboard.md`、行銷與定價頁＝`evals/tasks/pricing.md`）× 2 組（plain＝無工具、luca＝裝 Luca Style 並附文件）× 3 次。三份題目定案後不改（P2 重用）；兩組讀同一份題目。模型 `claude-sonnet-5-5`、effort medium、每次上限 $5、逾時 45 分鐘，旗標與隔離設定和 ISSUE-011 相同。

## 中位數

每格（場景 × 組）是該格有效的 3 次之中位數；失敗的執行也算在內（評不到的欄位，例如建置失敗時沒有 axe，只取有值的次數）。**狀態缺漏、axe、溢出只在同一個場景內比較**：三個場景的版面與內容不同，缺漏判定又依各狀態內容是否相異，跨場景的絕對數字不能直接比。「遺失本地改動」不適用，那是 ISSUE-014 更新題的指標。

### 後台與 CRUD（crud）

| 組別 | 有效次數 | 通過 | 費用 | 時間 | 寫死顏色 | axe serious / critical | 溢出 1280 / 834 / 390 | 狀態缺漏 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| plain（無工具） | 3 | 3 / 3 | $0.14 | 0.9 分 | 42 | 0 / 0 | 0 / 0 / 0 | 0 |
| luca（裝 Luca Style 並附文件） | 3 | 3 / 3 | $0.30 | 1.1 分 | 1 | 0 / 0 | 0 / 0 / 0 | 0 |

### 資料儀表板與監控（dashboard）

| 組別 | 有效次數 | 通過 | 費用 | 時間 | 寫死顏色 | axe serious / critical | 溢出 1280 / 834 / 390 | 狀態缺漏 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| plain（無工具） | 3 | 3 / 3 | $0.19 | 1.3 分 | 49 | 5 / 0 | 0 / 0 / 0 | 0 |
| luca（裝 Luca Style 並附文件） | 3 | 3 / 3 | $0.35 | 1.5 分 | 0 | 0 / 0 | 0 / 0 / 0 | 0 |

### 行銷與定價頁（pricing）

| 組別 | 有效次數 | 通過 | 費用 | 時間 | 寫死顏色 | axe serious / critical | 溢出 1280 / 834 / 390 | 狀態缺漏 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| plain（無工具） | 3 | 3 / 3 | $0.13 | 0.9 分 | 44 | 0 / 0 | 0 / 0 / 0 | 0 |
| luca（裝 Luca Style 並附文件） | 3 | 3 / 3 | $0.30 | 1.2 分 | 0 | 0 / 0 | 0 / 0 / 0 | 0 |

## 每一次的結果

| 結果檔 | 場景 | 組別 | outcome | 費用 | 時間 | 寫死顏色 | axe s / c | 溢出 | 缺漏 | 隔離 | DESIGN.md / llms.txt / 套件檔 讀取 | 取代 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-03-03-29-54-crud-plain.json | crud | plain | passed | $0.14 | 0.9 分 | 44 | 0 / 0 | 0 / 0 / 0 | 0 | 通過 | 0 / 0 / 0 |  |
| 2026-11-03-03-31-19-crud-plain.json | crud | plain | passed | $0.15 | 1.0 分 | 41 | 0 / 0 | 0 / 0 / 0 | 0 | 通過 | 0 / 0 / 0 |  |
| 2026-11-03-03-32-38-crud-plain.json | crud | plain | passed | $0.13 | 0.8 分 | 42 | 0 / 0 | 0 / 0 / 0 | 0 | 通過 | 0 / 0 / 0 |  |
| 2026-11-03-03-33-47-crud-luca.json | crud | luca | passed | $0.25 | 0.9 分 | 1 | 0 / 0 | 0 / 0 / 0 | 0 | 通過 | 0 / 2 / 6 |  |
| 2026-11-03-03-35-10-crud-luca.json | crud | luca | passed | $0.33 | 1.3 分 | 1 | 0 / 0 | 0 / 0 / 0 | 0 | 通過 | 1 / 2 / 8 |  |
| 2026-11-03-03-37-00-crud-luca.json | crud | luca | harness-error | $0.32 | 1.2 分 | 1 | — / — | — / — / — | 4 | 通過 | 1 / 2 / 8 |  |
| 2026-11-03-03-38-24-dashboard-plain.json | dashboard | plain | passed | $0.19 | 1.3 分 | 49 | 0 / 0 | 0 / 0 / 0 | 0 | 通過 | 0 / 0 / 0 |  |
| 2026-11-03-03-39-22-crud-luca.json | crud | luca | passed | $0.30 | 1.1 分 | 1 | 0 / 0 | 0 / 0 / 0 | 0 | 通過 | 1 / 2 / 8 | 2026-11-03-03-37-00-crud-luca.json |
| 2026-11-03-03-40-09-dashboard-plain.json | dashboard | plain | passed | $0.27 | 1.6 分 | 44 | 6 / 0 | 0 / 0 / 0 | 0 | 通過 | 0 / 0 / 0 |  |
| 2026-11-03-03-41-00-dashboard-plain.json | dashboard | plain | passed | $0.19 | 1.3 分 | 53 | 5 / 0 | 0 / 0 / 0 | 0 | 通過 | 0 / 0 / 0 |  |
| 2026-11-03-03-43-17-dashboard-luca.json | dashboard | luca | passed | $0.35 | 1.5 分 | 0 | 0 / 0 | 0 / 0 / 0 | 0 | 通過 | 1 / 2 / 8 |  |
| 2026-11-03-03-45-19-dashboard-luca.json | dashboard | luca | passed | $0.35 | 1.5 分 | 0 | 5 / 0 | 0 / 0 / 0 | 0 | 通過 | 1 / 2 / 7 |  |
| 2026-11-03-03-47-23-dashboard-luca.json | dashboard | luca | passed | $0.38 | 1.7 分 | 0 | 0 / 0 | 0 / 0 / 0 | 0 | 通過 | 1 / 2 / 8 |  |
| 2026-11-03-03-49-38-pricing-plain.json | pricing | plain | passed | $0.12 | 0.8 分 | 47 | 0 / 0 | 0 / 0 / 0 | 0 | 通過 | 0 / 0 / 0 |  |
| 2026-11-03-03-50-53-pricing-plain.json | pricing | plain | passed | $0.13 | 0.9 分 | 44 | 0 / 0 | 0 / 0 / 0 | 0 | 通過 | 0 / 0 / 0 |  |
| 2026-11-03-03-52-09-pricing-plain.json | pricing | plain | passed | $0.20 | 1.2 分 | 43 | 0 / 0 | 0 / 0 / 0 | 0 | 通過 | 0 / 0 / 0 |  |
| 2026-11-03-03-53-48-pricing-luca.json | pricing | luca | passed | $0.26 | 1.1 分 | 0 | 0 / 0 | 0 / 0 / 0 | 0 | 通過 | 0 / 2 / 6 |  |
| 2026-11-03-03-55-30-pricing-luca.json | pricing | luca | passed | $0.30 | 1.2 分 | 0 | 0 / 0 | 0 / 0 / 0 | 0 | 通過 | 1 / 2 / 3 |  |
| 2026-11-03-03-57-13-pricing-luca.json | pricing | luca | passed | $0.31 | 1.3 分 | 0 | 0 / 0 | 0 / 0 / 1 | 0 | 通過 | 1 / 2 / 7 |  |

## 所有失敗的執行

- 2026-11-03-03-37-00-crud-luca.json（crud × luca）：harness-error／harness-exception；harness 例外（事後確認）：npm run build 回傳失敗但沒有任何輸出（outputTail 為空）；代理自己回報建置成功。當時 driver 腳本被停止、行程失去主控台，判斷是 harness 的 build 步驟被中斷，不是代理的專案問題（未能重建驗證）；harness 造成，已由 2026-11-03-03-39-22-crud-luca.json 補跑取代，原紀錄保留

## 隔離判定的更正（重判，不重跑）

第一批 crud × luca 的 3 次被舊的越界規則誤判：代理 `cd` 進 `node_modules/@luca-style/react` 後直接 `cat llms.txt`（沒有路徑），舊規則把裸的 `llms.txt` 當越界，與協調者「讀已安裝套件自己的檔案不算越界」的裁定不符。規則更正後（`rejudgeIsolation`），用保存的 claude 輸出重判，不重跑、不花錢；原判定保留在結果檔的 `originalJudgement`，下列各檔都可對照：
- 2026-11-03-03-33-47-crud-luca.json：原判定 harness-error／isolation（隔離失敗：有 1 個工具呼叫碰到禁止的路徑），重判後 passed
- 2026-11-03-03-35-10-crud-luca.json：原判定 harness-error／isolation（隔離失敗：有 1 個工具呼叫碰到禁止的路徑），重判後 passed
- 2026-11-03-03-37-00-crud-luca.json：原判定 harness-error／isolation（隔離失敗：有 1 個工具呼叫碰到禁止的路徑），重判後 harness-error

「失敗」= outcome 不是 `passed`：隔離失敗、逾時、超出預算（含撞到單次 $5 上限）、輸出不是 JSON、建置失敗、harness 例外。失敗的執行不重跑來換掉；只有 harness 例外（工具本身壞掉，`harnessCause: harness-exception`）可以補跑，每格最多一次，新檔用 `supersedes` 指向原檔，原檔保留並列在上方，有效次數維持 3。隔離失敗與模型造成的失敗不補跑。

## 處理（treatment）與可比性

- luca 組的文件優勢就是被量的處理：README 指向、`docs/consumer-guide.md`（與 repo 逐位元組相同）、已安裝套件內附的 `DESIGN.md` 與 `llms.txt`。plain 組只有同一份 README 的中性段落。兩組的指令、旗標與 settings 相同，差別只有工作區內容。
- 依協調者裁定，luca 組讀已安裝套件自己的檔案（`node_modules/@luca-style/*`）是處理的一部分，只記錄不算越界；越界仍是提到 repo 路徑、套件外的 `examples/`、工作區以外的路徑、`~/.claude`。plain 組提到 luca 也算越界。上表最後兩欄記錄讀取次數。
- ISSUE-011 試跑的 luca 組只被指向 `DESIGN.md`；這次給的是指南加 DESIGN.md／llms.txt，兩者**不可比**，試跑結果不計入這 18 次。
- 題目裡「表單欄位要有標籤」那行與 `crud.md` 逐字相同，但對儀表板與定價頁只是鬆散相關（這兩題的表單很少）。

## 執行過程揭露

- 兩個 driver 腳本同時在跑：停掉第一個 driver 時只結束了外層，它的迴圈繼續開跑，所以約有 4 次執行（crud × luca 補跑與 dashboard × plain 的前幾次）和第二個 driver 重疊。重疊會影響單次耗時、也可能和評分器共用連接埠 4190（所有結果檔的評分都成功，沒有因此失敗）。發現後結束了多出來的 dashboard × plain 第 4 次，那次尚未寫出任何結果檔，其用量沒有記錄（估計不到 $0.3），不在報告的費用合計裡。
- 因此耗時的中位數只作粗略參考。

## 費用與風險

- 實際合計（含被取代的檔）$4.67，以 API 價格換算；實際消耗的是擁有者 claude.ai 訂閱額度，不是另外付費。
- 風險一：預估 $3.66 只來自後台與 CRUD 的各 1 次試跑；儀表板題目較大，費用可能高於預估。
- 風險二：撞到單次 $5 上限的執行算失敗（不重跑）。
- 風險三：累計等價費用超過 $8 就停止並回報；停止會讓報告停在 INCOMPLETE。護欄在每次開跑前檢查，所以最後一次可能超出至多 $5。被取代的檔也算進累計。

## 給 ISSUE-014

ISSUE-014 的 npm 組沿用「後台與 CRUD × luca」的有效 3 次：`2026-11-03-03-33-47-crud-luca.json`、`2026-11-03-03-35-10-crud-luca.json`、`2026-11-03-03-39-22-crud-luca.json`。指南版本 `64ec331`。
