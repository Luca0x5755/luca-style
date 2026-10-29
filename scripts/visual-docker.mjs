// 在官方 Playwright Linux Docker 映像內執行截圖比對或更新基準。
// 用法：node scripts/visual-docker.mjs <test|update [--all]> [--dry-run]；`--print-image` 只印出映像標籤。
//   update 預設只改寫比對失敗的基準（--update-snapshots=changed）；
//   --all 改寫全部基準，用於改動低於比對門檻、changed 偵測不到的情況（例如中性色微調）。
//   --dry-run 只以 JSON 印出將傳給 docker 的引數，不執行 Docker（tests/visual-config.spec.ts 用）。
// 映像版本取自已安裝的 @playwright/test，與 pages.yml 的 visual job 使用同一個映像。
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
const { version } = JSON.parse(readFileSync(new URL('../node_modules/@playwright/test/package.json', import.meta.url), 'utf8'));
const image = `mcr.microsoft.com/playwright:v${version}-noble`;
const [mode, ...flags] = process.argv.slice(2);

if (mode === '--print-image') {
  console.log(image);
  process.exit(0);
}
const usage = '用法：node scripts/visual-docker.mjs <test|update [--all]> [--dry-run]';
const allowed = mode === 'update' ? ['--all', '--dry-run'] : ['--dry-run'];
// 不認得的模式或旗標（含對 test 帶 --all）直接報錯，避免旗標被默默忽略而跑了不同的動作。
const unknown = flags.filter((flag) => !allowed.includes(flag));
if ((mode !== 'test' && mode !== 'update') || unknown.length) {
  console.error(unknown.length ? `不認得的引數：${unknown.join(' ')}\n${usage}` : usage);
  process.exit(2);
}

// 容器內 node_modules 放在命名 volume：Windows 安裝的原生套件不能在 Linux 使用，也不污染本機目錄。
const volume = 'luca-style-visual-node-modules';
const playwrightArgs = mode === 'test' ? '--update-snapshots=none' : flags.includes('--all') ? '--update-snapshots=all' : '--update-snapshots=changed';
const inner = `npm ci --no-audit --no-fund && npm run build && npx playwright test --project=visual ${playwrightArgs}`;
const args = ['run', '--rm', '--ipc=host', '-e', 'PW_VISUAL=1', '-v', `${root}:/work`, '-v', `${volume}:/work/node_modules`, '-w', '/work', image, 'sh', '-c', inner];
if (flags.includes('--dry-run')) {
  console.log(JSON.stringify(args));
  process.exit(0);
}
const result = spawnSync('docker', args, { stdio: 'inherit' });
if (result.error) {
  console.error(`無法執行 docker：${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
