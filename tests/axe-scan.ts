import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// 掃描目前頁面，依 PR-STYLE-41 分級：serious、critical 擋下，其餘只列報告。
// include 給 CSS 選擇器時只掃該範圍，供測試載具只檢查單一樣本區。
export type Finding = { id: string; impact: string; help: string; targets: string[] };
const blockingImpacts = new Set(['serious', 'critical']);

export async function scan(page: Page, include?: string) {
  const builder = new AxeBuilder({ page });
  const results = await (include ? builder.include(include) : builder).analyze();
  // 只留可讀的欄位，失敗訊息才看得懂是哪條規則、哪個節點。
  const findings: Finding[] = results.violations.map(v => ({
    id: v.id, impact: v.impact ?? 'unknown', help: v.help, targets: v.nodes.map(n => n.target.join(' ')),
  }));
  return {
    violations: results.violations,
    blocking: findings.filter(f => blockingImpacts.has(f.impact)),
    reported: findings.filter(f => !blockingImpacts.has(f.impact)),
  };
}
