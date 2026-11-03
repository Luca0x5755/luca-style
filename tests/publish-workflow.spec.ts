import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// 發佈工作流程（PR-ADOPT-10、PR-ADOPT-11）：不連網，以固定縮排的文字結構切出頂層區塊、job 與步驟。
// 試跑與真正發佈分成兩個檔，讓「真正發佈只由 workflow_dispatch 觸發」能直接從 on 區塊看出。
const load = (name: string) =>
  readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

const topBlock = (yml: string, key: string) => yml.match(new RegExp(`^${key}:[^\\n]*\\n((?:(?: .*)?\\n?)*)`, 'm'))?.[1] ?? '';
const job = (yml: string, name: string) => topBlock(yml, 'jobs').match(new RegExp(`^  ${name}:\\n((?:(?:    .*)?\\n?)*)`, 'm'))?.[1] ?? '';
const jobNames = (yml: string) => [...topBlock(yml, 'jobs').matchAll(/^ {2}([\w-]+):\s*$/gm)].map((m) => m[1]);
// 把 job 的 steps 區塊切成一步一段文字（步驟以六格縮排的「- 」開頭）。
const steps = (block: string) => (block.split(/^ {4}steps:\s*\n/m)[1] ?? '').split(/^(?= {6}- )/m).filter((s) => s.trim());
const runOf = (step: string) => step.match(/^\s*(?:- )?run:\s*(.+)$/m)?.[1].trim() ?? '';
const grants = (text: string) => [...text.matchAll(/^\s+([\w-]+):\s*(read|write|none)\s*$/gm)].map((m) => `${m[1]}: ${m[2]}`).sort();
// job 層級（不含 steps）的設定文字，用來檢查 permissions、if、environment。
const header = (block: string) => block.split(/^ {4}steps:/m)[0];
const isPublish = (cmd: string) => /\b(npm publish|changeset publish)\b/.test(cmd);

const dryRun = load('publish-dry-run.yml');
const publish = load('publish.yml');
const gateCommand = 'node scripts/check-publish-gate.mjs evals/results/copy-vs-npm.json';

for (const [file, yml] of [['publish-dry-run.yml', dryRun], ['publish.yml', publish]] as const) {
  test(`${file}: every action is pinned to a full commit SHA and no step swallows a failure`, () => {
    const uses = [...yml.matchAll(/^\s*(?:- )?uses:\s*(\S+)/gm)].map((m) => m[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const ref of uses) expect(ref, ref).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
    expect(yml).not.toContain('continue-on-error');
    expect(yml).not.toMatch(/write-all|read-all/);
  });

  test(`${file}: no literal npm token is written into the file`, () => {
    expect(yml).not.toMatch(/npm_[A-Za-z0-9]{20,}/);
    expect(yml).not.toMatch(/_authToken\s*=\s*(?!\$\{)\S/);
  });

  test(`${file}: top-level permissions only read contents`, () => {
    expect(grants(topBlock(yml, 'permissions'))).toEqual(['contents: read']);
  });
}

// ---- 試跑 ----

test('dry run runs on pull requests and pushes to main, and needs no secrets or environment', () => {
  const on = topBlock(dryRun, 'on');
  expect(on).toMatch(/^ {2}pull_request:\s*$/m);
  expect(on).toMatch(/push:\s*\n\s+branches:\s*\[\s*main\s*\]/);
  expect(dryRun).not.toContain('NPM_TOKEN');
  expect(dryRun).not.toMatch(/secrets\./);
  expect(dryRun).not.toMatch(/^\s+environment:/m);
});

test('dry run job only adds id-token: write for provenance', () => {
  expect(jobNames(dryRun)).toEqual(['dry-run']);
  expect(grants(header(job(dryRun, 'dry-run')))).toEqual(['id-token: write']);
});

// 分叉 PR 拿不到 id-token；Dependabot 的 PR 雖是同 repo 也拿不到，這類 PR 接受跳過。
test('dry run job skips pull requests from forks', () => {
  expect(header(job(dryRun, 'dry-run'))).toMatch(
    /^\s+if:\s*github\.event_name != 'pull_request' \|\| github\.event\.pull_request\.head\.repo\.full_name == github\.repository\s*$/m,
  );
});

test('dry run applies the changeset first, then publishes each package by name with --dry-run', () => {
  const cmds = steps(job(dryRun, 'dry-run')).map(runOf);
  const version = cmds.indexOf('npx changeset version');
  const tokens = cmds.findIndex((c) => /^npm publish\b.*--workspace @luca-style\/tokens\b/.test(c));
  const react = cmds.findIndex((c) => /^npm publish\b.*--workspace @luca-style\/react\b/.test(c));
  expect(version, cmds.join(' | ')).toBeGreaterThanOrEqual(0);
  expect(tokens).toBeGreaterThan(version);
  expect(react).toBeGreaterThan(version);
  for (const i of [tokens, react]) expect(cmds[i]).toMatch(/--dry-run/);
  for (const i of [tokens, react]) expect(cmds[i]).toMatch(/--provenance/);
});

test('every npm publish in the dry run carries --dry-run and nothing runs changeset publish', () => {
  const publishes = steps(job(dryRun, 'dry-run')).map(runOf).filter(isPublish);
  expect(publishes).toHaveLength(2);
  for (const cmd of publishes) expect(cmd).toContain('--dry-run');
  expect(dryRun).not.toMatch(/changeset publish/);
});

test('dry run builds before it publishes and verifies registry signatures', () => {
  const cmds = steps(job(dryRun, 'dry-run')).map(runOf);
  expect(cmds.indexOf('npm run build')).toBeGreaterThanOrEqual(0);
  expect(cmds.indexOf('npm run build')).toBeLessThan(cmds.findIndex(isPublish));
  expect(cmds).toContain('npm audit signatures');
});

// ---- 真正發佈 ----

test('real publish can only be started by hand', () => {
  const keys = [...topBlock(publish, 'on').matchAll(/^ {2}([\w-]+):/gm)].map((m) => m[1]);
  expect(keys).toEqual(['workflow_dispatch']);
  expect(jobNames(publish)).toEqual(['publish']);
  expect(header(job(publish, 'publish'))).not.toMatch(/^\s+if:/m);
});

test('real publish waits for owner confirmation through the npm-publish environment', () => {
  expect(header(job(publish, 'publish'))).toMatch(/^\s+environment:\s*npm-publish\s*$/m);
});

test('real publish job adds only id-token: write for provenance', () => {
  expect(grants(header(job(publish, 'publish')))).toEqual(['id-token: write']);
});

test('gate step runs after checkout and before any publish step, and cannot be skipped', () => {
  const list = steps(job(publish, 'publish'));
  const gates = list.filter((s) => runOf(s).includes('check-publish-gate'));
  expect(gates).toHaveLength(1);
  const gate = gates[0];
  expect(runOf(gate)).toBe(gateCommand);
  expect(gate).not.toMatch(/^\s+if:/m);
  expect(gate).not.toContain('continue-on-error');
  expect(gate).not.toMatch(/\|\||set \+e|;/);
  const at = list.indexOf(gate);
  const checkout = list.findIndex((s) => /uses:\s*actions\/checkout@/.test(s));
  const firstPublish = list.findIndex((s) => isPublish(runOf(s)));
  expect(checkout).toBeGreaterThanOrEqual(0);
  expect(checkout).toBeLessThan(at);
  expect(firstPublish).toBeGreaterThan(at);
});

test('every real publish lives in publish.yml after the gate, and the dry-run file never publishes for real', () => {
  const list = steps(job(publish, 'publish'));
  const at = list.findIndex((s) => runOf(s) === gateCommand);
  const real = list.map((s, i) => [runOf(s), i] as const).filter(([c]) => isPublish(c));
  expect(real.length).toBeGreaterThan(0);
  for (const [cmd, i] of real) {
    expect(i, cmd).toBeGreaterThan(at);
    expect(cmd).not.toContain('--dry-run');
  }
  const names = real.map(([c]) => c.match(/--workspace (\S+)/)?.[1]);
  expect(names.sort()).toEqual(['@luca-style/react', '@luca-style/tokens']);
  for (const cmd of steps(job(dryRun, 'dry-run')).map(runOf)) {
    if (isPublish(cmd)) expect(cmd).toContain('--dry-run');
  }
});

test('npm token comes only from the CI secret, only inside publish.yml, and only on publish steps', () => {
  const refs = [...publish.matchAll(/^.*NPM_TOKEN.*$/gm)].map((m) => m[0].trim());
  expect(refs.length).toBeGreaterThan(0);
  for (const line of refs) expect(line).toMatch(/^NODE_AUTH_TOKEN:\s*\$\{\{\s*secrets\.NPM_TOKEN\s*\}\}$/);
  expect([...publish.matchAll(/secrets\.(\w+)/g)].map((m) => m[1])).toEqual(refs.map(() => 'NPM_TOKEN'));
  const holders = steps(job(publish, 'publish')).filter((s) => s.includes('NPM_TOKEN'));
  for (const s of holders) expect(runOf(s)).toMatch(/\bnpm publish\b/);
});

test('the job that holds the token installs without lifecycle scripts and verifies signatures first', () => {
  const cmds = steps(job(publish, 'publish')).map(runOf);
  const installs = cmds.filter((c) => /^npm (ci|install)\b/.test(c));
  expect(installs).toEqual(['npm ci --ignore-scripts']);
  const audit = cmds.indexOf('npm audit signatures');
  expect(audit).toBeGreaterThan(cmds.indexOf('npm ci --ignore-scripts'));
  expect(audit).toBeLessThan(cmds.findIndex(isPublish));
});

test('publish applies pending changesets and builds before publishing', () => {
  const cmds = steps(job(publish, 'publish')).map(runOf);
  const first = cmds.findIndex(isPublish);
  expect(cmds.indexOf('npx changeset version')).toBeGreaterThanOrEqual(0);
  expect(cmds.indexOf('npx changeset version')).toBeLessThan(first);
  expect(cmds.indexOf('npm run build')).toBeLessThan(first);
});

test('the other workflows still exist', () => {
  expect(load('pages.yml')).toContain('name: Deploy Pages');
  expect(readFileSync(new URL('../.github/workflows/issues-check.yml', import.meta.url), 'utf8')).toContain('issues-check:');
});

// 閘門的條件（complete 與 copyBetter）寫在 publish.yml 的檔頭說明裡，行為由 tests/publish-gate.spec.ts 驗證。
test('publish.yml header states the gate needs a complete verdict and copyBetter false', () => {
  const raw = readFileSync(new URL('../.github/workflows/publish.yml', import.meta.url), 'utf8');
  expect(raw).toMatch(/complete 為 true 且 copyBetter 為 false/);
});

// ---- dist-tag 與只發佈已提交的版本（PR-RELEASE-01、PR-RELEASE-02） ----

// workflow_dispatch.inputs 底下每個 input 一段文字（input 名稱在六格縮排）。
const dispatchInputs = (yml: string) => {
  const inputs = topBlock(yml, 'on').split(/^ {4}inputs:\s*\n/m)[1] ?? '';
  const out: Record<string, string> = {};
  for (const part of inputs.split(/^(?= {6}[\w-]+:\s*$)/m).filter((s) => s.trim())) {
    out[part.match(/^ {6}([\w-]+):/)![1]] = part;
  }
  return out;
};
const optionsOf = (block: string) => {
  const inline = block.match(/^\s+options:\s*\[(.*)\]\s*$/m)?.[1];
  if (inline !== undefined) return inline.split(',').map((s) => s.trim());
  const list = block.split(/^ {8}options:\s*\n/m)[1] ?? '';
  return [...list.matchAll(/^ {10}- (\S+)\s*$/gm)].map((m) => m[1]);
};

test('PR-RELEASE-01: manual run offers one choice input, next or latest, defaulting to next', () => {
  const inputs = dispatchInputs(publish);
  expect(Object.keys(inputs)).toHaveLength(1);
  const block = Object.values(inputs)[0];
  expect(block).toMatch(/^\s+type:\s*choice\s*$/m);
  expect(optionsOf(block)).toEqual(['next', 'latest']);
  expect(block).toMatch(/^\s+default:\s*next\s*$/m);
});

test('PR-RELEASE-01: both npm publish steps pass the chosen tag and never a hardcoded one', () => {
  const name = Object.keys(dispatchInputs(publish))[0];
  const publishes = steps(job(publish, 'publish')).map(runOf).filter(isPublish);
  expect(publishes).toHaveLength(2);
  for (const cmd of publishes) {
    expect(cmd).toContain(`--tag \${{ inputs.${name} }}`);
    expect(cmd).not.toMatch(/--tag (next|latest)\b/);
  }
});

test('PR-RELEASE-02: the job fails on any working-tree change after changeset version and before the first publish', () => {
  const list = steps(job(publish, 'publish'));
  const check = list.filter((s) => runOf(s) === 'test -z "$(git status --porcelain)"');
  expect(check).toHaveLength(1);
  const step = check[0];
  expect(step).not.toMatch(/^\s+if:/m);
  expect(step).not.toContain('continue-on-error');
  expect(step).not.toMatch(/\|\||set \+e|;/);
  const at = list.indexOf(step);
  const version = list.findIndex((s) => runOf(s) === 'npx changeset version');
  const firstPublish = list.findIndex((s) => isPublish(runOf(s)));
  expect(version).toBeGreaterThanOrEqual(0);
  expect(at).toBeGreaterThan(version);
  expect(firstPublish).toBeGreaterThan(at);
});
