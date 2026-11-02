# 評測試跑報告

由 `node evals/report.mjs` 從 `evals/results/*.json` 產生，不要手改。

模型固定為 `claude-sonnet-5-5`（effort medium，每次上限 $5），所有評測都用它。題目是 `evals/tasks/crud.md`，兩組讀同一個檔。

分數：寫死顏色數；axe 的 serious、critical 數（依規則與元素去重，4 狀態 × 3 寬度）；1280、834、390 各有幾個狀態水平溢出；四種狀態缺漏數。評分規則見 `evals/grade.mjs`。

| 結果檔 | 組別 | 模型 | 費用 | 時間 | 回合 | 寫死顏色 | axe serious / critical | 溢出 1280 / 834 / 390 | 狀態缺漏 | 隔離 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-02-12-30-crud-plain.json | plain | claude-sonnet-5-5 | $0.23 | 1.4 分 | 12 | 42 | 0 / 0 | 0 / 0 / 0 | 0 | 通過 |
| 2026-11-02-12-35-crud-luca.json | luca | claude-sonnet-5-5 | $0.18 | 1.1 分 | 18 | 1 | 0 / 0 | 0 / 0 / 0 | 0 | 通過 |

## 隔離

每次都用 `--safe-mode --setting-sources "" --strict-mcp-config --disable-slash-commands --no-session-persistence --restricted`，工具限定六種，Bash 只允許三種 npm 指令（`dontAsk`），另以 `--settings` 拒絕 repo、`~/.claude` 與全域 npm 的路徑。完整旗標在各結果檔的 `flags`。

- 記憶依專案路徑存放，每次都是新的暫存目錄，沒有記憶；debug 紀錄的 `project memory is off` 也顯示沒有載入。
- Claude Code 自帶的 plugin（init 裡 `path` 為 `builtin`）是 CLI 本身的一部分，不是使用者安裝的，所以不算載入個人設定（協調者 2026-11-02 裁定）；其他 plugin 一律算隔離失敗。
- init 的 `agents` 列出的是 Claude Code 內建的 agent（claude、Explore、general-purpose、Plan、web-fetch），不是空的；個人 skill、agent、command 的名稱都有比對，出現就算隔離失敗。
- debug 紀錄的「31 bundled skills」是 CLI 自帶的 skill；init 的 `skills` 與 `slash_commands` 是空的，`--disable-slash-commands` 也關掉叫用，`[reduced mode] Skipping skill dir discovery` 表示個人與專案的 skill 目錄沒有被讀。

### 2026-11-02-12-30-crud-plain.json

- 判定：通過；原判定「init 的 plugins 不是空的」，依上方裁定重判
- 內建 plugin：cc-plugin-agents-md、cc-plugin-telemetry、cc-plugin-plugin-authoring
- 使用者層級的 `~/.claude/CLAUDE.md`：不存在
- init 的 skills、mcp_servers、slash_commands：skills []，mcp_servers []，slash_commands []；agents ["claude","Explore","general-purpose","Plan","web-fetch"]
- 金絲雀 CLAUDE.md：沒有出現在任何訊息
- debug 紀錄中和 CLAUDE.md、memory、rules、skill 有關的行（去重，不含權限建議）：`Loading skills from: managed=C:\Program Files\ClaudeCode\.claude\skills, user=C:\Users\x1596\.claude\skills, project=[]`；`[reduced mode] Skipping skill dir discovery`；`getSkills returning: 0 skill dir commands, 0 plugin skills, 31 bundled skills, 1 builtin plugin skills`；`$.fs.ancestors (cc-plugin-agents-md): project memory is off`
- 工具呼叫 11 次，越界 0 次，被拒絕 1 次（Bash: cat > src/main.tsx <<'EOF'）；本次沒有越界嘗試，路徑的拒絕規則未被實際觸發

### 2026-11-02-12-35-crud-luca.json

- 判定：通過
- 內建 plugin：cc-plugin-agents-md、cc-plugin-telemetry、cc-plugin-plugin-authoring
- 使用者層級的 `~/.claude/CLAUDE.md`：不存在
- init 的 skills、mcp_servers、slash_commands：skills []，mcp_servers []，slash_commands []；agents ["claude","Explore","general-purpose","Plan","web-fetch"]
- 金絲雀 CLAUDE.md：沒有出現在任何訊息
- debug 紀錄中和 CLAUDE.md、memory、rules、skill 有關的行（去重，不含權限建議）：`Loading skills from: managed=C:\Program Files\ClaudeCode\.claude\skills, user=C:\Users\x1596\.claude\skills, project=[]`；`[reduced mode] Skipping skill dir discovery`；`getSkills returning: 0 skill dir commands, 0 plugin skills, 31 bundled skills, 1 builtin plugin skills`；`$.fs.ancestors (cc-plugin-agents-md): project memory is off`
- 工具呼叫 17 次，越界 0 次，被拒絕 1 次（Bash: cd C:/Users/x1596/AppData/Local/Temp/eval-1aylx7/project; ls node_modules/@luca-）；本次沒有越界嘗試，路徑的拒絕規則未被實際觸發

## 18 次基準的預估費用

- 每組單次費用（試跑平均）：plain $0.23、luca $0.18
- 預估：3 個場景 × 3 次 × 每組單次費用，兩組相加 = **$3.66**（18 次）
- 上限：18 次 × 每次的費用上限 = $90.00
- 預估只根據後台與 CRUD 的試跑（plain 1 次、luca 1 次）；資料儀表板、行銷與定價頁沒有試跑，費用可能不同。
- ISSUE-014 另跑 9 次（複製組 3 次、更新題兩組各 3 次），它的 Notes 說 ISSUE-013 的同意已包含這 9 次：這些沒有試跑，用兩組中較高的單次費用估，合計 27 次約 $5.71，上限 $135.00。
