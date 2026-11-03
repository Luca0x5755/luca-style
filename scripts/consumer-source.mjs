// 決定 consumer 驗證的套件來源（PR-RELEASE-03）。
// local：打包本機 packages/ 再安裝 tarball（npm run test:consumer）。
// registry：從 npm registry 安裝已發佈的指定版本，並驗證來源證明（npm run test:registry -- <版本>）。
const packageNames = ['tokens', 'react'];
const usage = '用法：npm run test:registry -- <版本>，例如 npm run test:registry -- 0.3.0';

export function planConsumerSource(args) {
  const [mode, version] = args;
  if (mode === undefined) return {mode: 'local', pack: [...packageNames], install: null, audit: null};
  if (mode !== 'registry') throw new Error(`不認得的模式 ${mode}。${usage}`);
  if (!version || version.startsWith('-')) throw new Error(`缺少版本號。${usage}`);
  return {mode: 'registry', pack: [], install: packageNames.map(name => `@luca-style/${name}@${version}`), audit: ['audit', 'signatures']};
}

// 依計畫準備 consumer：打包或不打包、複製範例專案、安裝，registry 模式再驗證來源證明。
// 所有副作用都從 deps 注入，離線測試用假的 npm 就能觀察順序與引數；audit 失敗會讓這裡 reject。
export async function installConsumer(plan, deps) {
  for (const name of plan.pack) deps.npm(['pack', '--pack-destination', deps.temporary], deps.packageDir(name));
  await deps.copyConsumer();
  const sources = plan.install ?? await deps.listTarballs();
  deps.npm(['install', '--no-audit', '--no-fund', ...sources], deps.consumerDir);
  if (plan.audit) deps.npm(plan.audit, deps.consumerDir);
}
