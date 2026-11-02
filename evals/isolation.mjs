// 評測代理的隔離判定（ISSUE-011）：從 claude -p 輸出的 init 訊息，判斷有沒有載入個人設定。
// Claude Code 自帶的 plugin（path 為 builtin，例如 cc-plugin-agents-md、cc-plugin-telemetry、cc-plugin-plugin-authoring）
// 是 CLI 本身的一部分，不是使用者安裝的，所以不算；其他 plugin、任何 skill 或 MCP 伺服器都算隔離失敗（協調者 2026-11-02 裁定）。

const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// personalNames：~/.claude 底下個人 skill、agent、command 的名稱，出現在 init 的清單裡就是隔離失敗。
export function initProblems(init, personalNames) {
  if (!init) return ['輸出裡沒有 init 訊息'];
  const problems = [];
  if (init.skills?.length) problems.push(`init 的 skills 不是空的：${init.skills.join('、')}`);
  if (init.mcp_servers?.length) problems.push(`init 的 mcp_servers 不是空的：${init.mcp_servers.map(server => server.name ?? server).join('、')}`);
  const installed = (init.plugins ?? []).filter(plugin => plugin.path !== 'builtin');
  if (installed.length) problems.push(`init 有非內建的 plugin：${installed.map(plugin => plugin.name).join('、')}`);
  const listed = JSON.stringify([init.skills, init.slash_commands, init.agents]);
  const leaked = personalNames.filter(name => new RegExp(`["/:]${escapeRegex(name)}"`).test(listed));
  if (leaked.length) problems.push(`init 列出個人的 skill、agent 或 command：${leaked.join('、')}`);
  return problems;
}

// 寫進結果與報告用：內建 plugin 的名稱。
export const builtinPlugins = init => (init?.plugins ?? []).filter(plugin => plugin.path === 'builtin').map(plugin => plugin.name);
