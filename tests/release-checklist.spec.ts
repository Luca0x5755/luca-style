import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// PR-RELEASE-05、PR-RELEASE-06：發佈清單 docs/releasing.md 的步驟、順序、擁有者標記與發錯處理。
// 只讀文字，不連網；引用的名稱同時對照 publish.yml 與 package.json，避免清單與實作脫節。
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const guide = read('docs/releasing.md');
const OWNER = '【僅擁有者】';

// 以「## <序號>. 」切節；發錯處理另有自己的 ## 標題，不編號。
const sections = guide.split(/^(?=## )/m).filter((s) => s.startsWith('## '));
const numbered = sections.filter((s) => /^## \d+\. /.test(s));
const section = (n: number) => numbered.find((s) => s.startsWith(`## ${n}. `)) ?? '';
const tagInput = read('.github/workflows/publish.yml').match(/^ {6}([\w-]+):\s*\n\s+description:[^\n]*\n\s+type: choice/m)?.[1] ?? '';

test('PR-RELEASE-05: the checklist has six numbered steps, in order 1 to 6', () => {
  expect(numbered.map((s) => s.match(/^## (\d+)\./)![1])).toEqual(['1', '2', '3', '4', '5', '6']);
});

test('PR-RELEASE-05 step 1 merges the version commit into main', () => {
  expect(section(1)).toContain('`npx changeset version`');
  expect(section(1)).toContain('合併進 `main`');
});

test('PR-RELEASE-05 step 2 triggers publish.yml from main with the next dist-tag and the npm-publish approval', () => {
  const s = section(2);
  expect(tagInput, 'publish.yml 找不到 choice input').not.toBe('');
  expect(s).toContain('publish.yml');
  expect(s).toContain('main');
  expect(s).toContain(`\`${tagInput}\``);
  expect(s).toMatch(/\bnext\b/);
  expect(s).toContain('npm-publish');
});

test('PR-RELEASE-05 step 3 verifies the next version with the test:registry command that package.json defines', () => {
  expect(JSON.parse(read('package.json')).scripts['test:registry']).toBeTruthy();
  expect(section(3)).toContain('npm run test:registry -- <版本>');
});

test('PR-RELEASE-05 step 4 is the consumer verification', () => {
  expect(section(4)).toMatch(/使用端/);
  expect(section(4)).toMatch(/automated_trading/);
});

test('PR-RELEASE-05 step 5 points latest at the version for both packages with npm dist-tag add', () => {
  const s = section(5);
  for (const name of ['tokens', 'react']) expect(s).toContain(`npm dist-tag add @luca-style/${name}@<版本> latest`);
});

test('PR-RELEASE-05 step 6 pushes an annotated v<版本> tag at the publish commit and says how to find the SHA', () => {
  const s = section(6);
  expect(s).toMatch(/git tag -a v<版本> <SHA>/);
  expect(s).toMatch(/git push origin v<版本>/);
  expect(s).toMatch(/Actions/);
  expect(s).toMatch(/執行紀錄/);
  expect(s).toMatch(/檢出|checkout/i);
});

test('PR-RELEASE-05 owner-only marker is on the approval, dist-tag add, tag push and deprecate sections and nowhere else', () => {
  expect(section(1)).not.toContain(OWNER);
  expect(section(2)).toContain(OWNER); // 環境審核的核准
  expect(section(3)).not.toContain(OWNER);
  expect(section(4)).not.toContain(OWNER);
  expect(section(5)).toContain(OWNER);
  expect(section(6)).toContain(OWNER);
  // 全文只有這四節有標記：三個編號步驟加發錯一節。
  const marked = sections.filter((x) => x.includes(OWNER)).map((x) => x.slice(0, x.indexOf('\n')));
  expect(marked).toHaveLength(4);
});

test('PR-RELEASE-06 the failure section forbids unpublish, requires a new version and an owner-only npm deprecate with a reason', () => {
  const s = sections.find((x) => /^## [^\n]*發錯/.test(x)) ?? '';
  expect(s, '找不到發錯處理一節').not.toBe('');
  expect(s).toMatch(/不 unpublish/);
  expect(s).toMatch(/新版本/);
  expect(s).toContain('npm deprecate @luca-style/<套件>@<版本> "<原因>"');
  expect(s).toContain(OWNER);
});

test('the checklist never contains a token value and names the secret only by name', () => {
  expect(guide).not.toMatch(/npm_[A-Za-z0-9]{20,}/);
  expect(guide).not.toMatch(/_authToken\s*=/);
});

test('the truth layer records PR-RELEASE-04 to 06 and the delivery table has a row each', () => {
  for (const id of ['PR-RELEASE-04', 'PR-RELEASE-05', 'PR-RELEASE-06']) {
    expect(read('docs/capabilities/design-system.md'), id).toMatch(new RegExp(`^${id} — `, 'm'));
    expect(read('docs/delivery-verification.md'), id).toMatch(new RegExp(`^\\| ${id} \\|`, 'm'));
  }
});
