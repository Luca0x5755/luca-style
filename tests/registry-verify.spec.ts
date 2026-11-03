import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installConsumer, planConsumerSource } from '../scripts/consumer-source.mjs';

// PR-RELEASE-03：從 npm registry 安裝已發佈版本並驗證。全部離線，registry 與 audit 的真實結果留到 ISSUE-019。

test('plan without a mode packs both local packages and runs no audit (test:consumer unchanged)', () => {
  expect(planConsumerSource([])).toEqual({ mode: 'local', pack: ['tokens', 'react'], install: null, audit: null });
});

test('registry plan installs both packages at the given version, packs nothing and audits signatures', () => {
  expect(planConsumerSource(['registry', '0.3.0'])).toEqual({
    mode: 'registry',
    pack: [],
    install: ['@luca-style/tokens@0.3.0', '@luca-style/react@0.3.0'],
    audit: ['audit', 'signatures'],
  });
});

for (const args of [['registry'], ['registry', ''], ['registry', '--tag']]) {
  test(`registry plan without a usable version throws usage: ${JSON.stringify(args)}`, () => {
    expect(() => planConsumerSource(args)).toThrow(/npm run test:registry -- <版本>/);
  });
}

// 假的 npm 只記錄呼叫；listTarballs 刻意回傳殘留的 tgz，證明 registry 模式不會去裝它。
const fakeDeps = (failOn?: string) => {
  const calls: { args: string[]; cwd: string }[] = [];
  const deps = {
    calls,
    npm: (args: string[], cwd: string) => {
      calls.push({ args, cwd });
      if (args[0] === failOn) throw new Error(`${args.join(' ')} failed`);
      return '';
    },
    copyConsumer: async () => {},
    listTarballs: async () => ['/tmp/leftover-tokens.tgz', '/tmp/leftover-react.tgz'],
    packageDir: (name: string) => `/repo/packages/${name}`,
    temporary: '/tmp',
    consumerDir: '/tmp/consumer',
  };
  return deps;
};

test('registry executor never packs, installs only the registry specs, then audits in the consumer project', async () => {
  const deps = fakeDeps();
  await installConsumer(planConsumerSource(['registry', '0.3.0']), deps);
  expect(deps.calls.map((c) => c.args[0])).toEqual(['install', 'audit']);
  expect(deps.calls[0].args).toEqual(['install', '--no-audit', '--no-fund', '@luca-style/tokens@0.3.0', '@luca-style/react@0.3.0']);
  expect(deps.calls[1]).toEqual({ args: ['audit', 'signatures'], cwd: '/tmp/consumer' });
});

test('a failing audit makes the registry executor reject', async () => {
  await expect(installConsumer(planConsumerSource(['registry', '0.3.0']), fakeDeps('audit'))).rejects.toThrow(/audit signatures failed/);
});

test('local executor packs both packages and installs their tarballs without auditing', async () => {
  const deps = fakeDeps();
  await installConsumer(planConsumerSource([]), deps);
  expect(deps.calls).toEqual([
    { args: ['pack', '--pack-destination', '/tmp'], cwd: '/repo/packages/tokens' },
    { args: ['pack', '--pack-destination', '/tmp'], cwd: '/repo/packages/react' },
    { args: ['install', '--no-audit', '--no-fund', '/tmp/leftover-tokens.tgz', '/tmp/leftover-react.tgz'], cwd: '/tmp/consumer' },
  ]);
});

// 以假的 npm_execpath 跑真正的 verify-consumer.mjs：不連網、不開瀏覽器，只看它對 npm 做了什麼。
// 假 npm 在 install 時寫出假的已安裝套件，在 run build 時以非零結束，所以腳本只會走到共用檢查的 build 這一步。
const script = fileURLToPath(new URL('../scripts/verify-consumer.mjs', import.meta.url));
const stubSource = String.raw`
const {appendFileSync, mkdirSync, writeFileSync} = require('node:fs');
const {join} = require('node:path');
const args = process.argv.slice(2);
appendFileSync(process.env.STUB_LOG, JSON.stringify({args, cwd: process.cwd()}) + '\n');
if (args[0] === 'install') {
  for (const [name, files] of [['tokens', ['LICENSE', 'design-tokens.md']], ['react', ['LICENSE', 'DESIGN.md', 'llms.txt']]]) {
    const dir = join(process.cwd(), 'node_modules', '@luca-style', name);
    mkdirSync(dir, {recursive: true});
    for (const file of files) writeFileSync(join(dir, file), file === 'LICENSE' ? 'MIT License\n' : 'stub\n');
  }
}
if (args[0] === 'audit' && process.env.STUB_FAIL_AUDIT) process.exit(1);
if (args[0] === 'run') process.exit(1);
`;

function runScript(args: string[], options: { failAudit?: boolean; withNpm?: boolean } = {}) {
  const work = mkdtempSync(join(tmpdir(), 'luca-registry-test-'));
  try {
    const stub = join(work, 'stub-npm.cjs');
    const log = join(work, 'calls.log');
    const privateTmp = join(work, 'tmp');
    mkdirSync(privateTmp);
    writeFileSync(stub, stubSource);
    writeFileSync(log, '');
    const env: NodeJS.ProcessEnv = { ...process.env, TEMP: privateTmp, TMP: privateTmp, TMPDIR: privateTmp, STUB_LOG: log };
    delete env.npm_execpath;
    if (options.withNpm !== false) env.npm_execpath = stub;
    if (options.failAudit) env.STUB_FAIL_AUDIT = '1';
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env, timeout: 60000 });
    const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as { args: string[]; cwd: string });
    const leftovers = readdirSync(privateTmp);
    return { ...result, calls, leftovers };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

test('registry mode without a version fails with usage before touching npm or the temp directory', () => {
  const result = runScript(['registry'], { withNpm: false });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toMatch(/npm run test:registry -- <版本>/);
  expect(result.calls).toEqual([]);
  expect(result.leftovers).toEqual([]);
});

test('registry mode installs the published versions, audits, then reaches the shared build check without packing', () => {
  const result = runScript(['registry', '0.0.0-test']);
  expect(result.calls.map((c) => c.args[0])).toEqual(['install', 'audit', 'run']);
  expect(result.calls[0].args).toEqual(['install', '--no-audit', '--no-fund', '@luca-style/tokens@0.0.0-test', '@luca-style/react@0.0.0-test']);
  expect(result.calls[1].args).toEqual(['audit', 'signatures']);
  // audit 與 install 在同一個暫存複本專案裡執行，不在 repo 裡。
  expect(result.calls[1].cwd).toBe(result.calls[0].cwd);
  expect(result.calls[1].cwd).toContain('luca-consumer-');
  expect(result.calls[2].args).toEqual(['run', 'build']);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toMatch(/run build failed/);
});

test('a failing audit fails the command and stops before the shared checks', () => {
  const result = runScript(['registry', '0.0.0-test'], { failAudit: true });
  expect(result.calls.map((c) => c.args[0])).toEqual(['install', 'audit']);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toMatch(/audit signatures failed/);
});

test('package.json wires test:registry to registry mode and leaves test:consumer alone', () => {
  const scripts = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')).scripts;
  expect(scripts['test:registry']).toBe('node scripts/verify-consumer.mjs registry');
  expect(scripts['test:consumer']).toBe('node scripts/verify-consumer.mjs');
});

test('truth layer records PR-RELEASE-03 and the delivery row says the real run is ISSUE-019', () => {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');
  expect(read('docs/capabilities/design-system.md')).toMatch(/^PR-RELEASE-03 — /m);
  expect(read('docs/delivery-verification.md')).toMatch(/^\| PR-RELEASE-03 \|.*ISSUE-019/m);
});
