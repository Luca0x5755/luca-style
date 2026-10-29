// 在官方 Playwright Linux Docker 映像內執行截圖比對或更新基準。
// 用法：node scripts/visual-docker.mjs <test|update>；`--print-image` 只印出映像標籤。
// 映像版本取自已安裝的 @playwright/test，與 pages.yml 的 visual job 使用同一個映像。
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
const { version } = JSON.parse(readFileSync(new URL('../node_modules/@playwright/test/package.json', import.meta.url), 'utf8'));
const image = `mcr.microsoft.com/playwright:v${version}-noble`;
const mode = process.argv[2];

if (mode === '--print-image') {
  console.log(image);
  process.exit(0);
}
if (mode !== 'test' && mode !== 'update') {
  console.error('用法：node scripts/visual-docker.mjs <test|update>');
  process.exit(2);
}

// 容器內 node_modules 放在命名 volume：Windows 安裝的原生套件不能在 Linux 使用，也不污染本機目錄。
const volume = 'luca-style-visual-node-modules';
const playwrightArgs = mode === 'update' ? '--update-snapshots=changed' : '--update-snapshots=none';
const inner = `npm ci --no-audit --no-fund && npm run build && npx playwright test --project=visual ${playwrightArgs}`;
const args = ['run', '--rm', '--ipc=host', '-e', 'PW_VISUAL=1', '-v', `${root}:/work`, '-v', `${volume}:/work/node_modules`, '-w', '/work', image, 'sh', '-c', inner];
const result = spawnSync('docker', args, { stdio: 'inherit' });
if (result.error) {
  console.error(`無法執行 docker：${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
