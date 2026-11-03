import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gradeProject } from '../evals/grade.mjs';
import { installEnv, listFiles, prepareCopyVsNpmProject, pristineLibraryFiles } from '../evals/copy-vs-npm-project.mjs';
import { applyLocalChange, copyGroupProblems, gradeUpdate, newVersionMarker } from '../evals/copy-vs-npm.mjs';

// 複製 vs npm 評測的起始專案（ISSUE-014）。不裝依賴的版本驗證檔案內容；裝依賴的版本真的建置，並用 gradeUpdate 評分。
const repoRoot = join(import.meta.dirname, '..');
const repoFile = (path: string) => readFile(join(repoRoot, path), 'utf8');
async function withProject<T>(kind: Parameters<typeof prepareCopyVsNpmProject>[0], install: boolean, body: (workspace: string, files: string[]) => Promise<T>) {
  const temporary = await mkdtemp(join(tmpdir(), 'cvn-'));
  const workspace = join(temporary, 'project');
  try {
    await prepareCopyVsNpmProject(kind, workspace, temporary, { install });
    return await body(workspace, await listFiles(workspace));
  } finally {
    await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
}
// vite 的 build()（theme-harness 在前面的 spec 用到）會把同一個測試行程的 NODE_ENV 設成 production，npm 看到它就不裝 devDependencies，
// tsc 找不到 @types/react-dom。起始專案的安裝與建置不能受行程環境影響，所以這個檔的每個測試都在 NODE_ENV=production 下跑，
// 把整份全套件才會碰到的狀況固定下來。
let savedNodeEnv: string | undefined;
test.beforeEach(() => { savedNodeEnv = process.env.NODE_ENV; process.env.NODE_ENV = 'production'; });
test.afterEach(() => { if (savedNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = savedNodeEnv; });
const sh = (command: string, args: string[], cwd: string) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', env: installEnv(process.env) });
  const found = result.status === 0 ? null : spawnSync('npm', ['ls', '@types/react-dom', '--all'], { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  const env = Object.entries(process.env).filter(([key]) => /^(npm_config|NODE_ENV|NPM)/i.test(key)).map(([key, value]) => `${key}=${value}`).join(' ');
  expect(result.status, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}\nENV ${env}\n${found?.stdout}`).toBe(0);
};

test('crud copy starter holds packages/react/src byte for byte, declares no @luca-style/react, and puts the docs at the project root', async () => {
  await withProject('crud-copy', false, async (workspace, files) => {
    for (const name of await readdir(join(repoRoot, 'packages/react/src'))) {
      expect(await readFile(join(workspace, 'src/luca-style', name), 'utf8'), name).toBe(await repoFile(`packages/react/src/${name}`));
    }
    expect(files).toEqual(expect.arrayContaining(['DESIGN.md', 'llms.txt', 'README.md', 'src/loading/tide-light.gif', 'src/fonts/fonts.css']));
    expect(files.some(file => file.startsWith('docs/'))).toBe(false);
    expect(copyGroupProblems({ packageJson: await readFile(join(workspace, 'package.json'), 'utf8'), installedReact: false })).toEqual([]);
    expect(await readFile(join(workspace, 'README.md'), 'utf8')).toContain('src/luca-style/');
  });
});

test('update x copy starter has the local change and not the new version; upgrade/react-src has the new version without the local change', async () => {
  await withProject('update-copy', false, async (workspace, files) => {
    const current = await readFile(join(workspace, 'src/luca-style/button.tsx'), 'utf8');
    expect(current).toContain('data-local-change');
    expect(current).not.toContain(newVersionMarker);
    expect(current).toBe(applyLocalChange(await repoFile('packages/react/src/button.tsx')));
    const upgraded = await readFile(join(workspace, 'upgrade/react-src/button.tsx'), 'utf8');
    expect(upgraded).toContain(newVersionMarker);
    expect(upgraded).not.toContain('data-local-change');
    expect(files).toContain('upgrade/react-src/theme.tsx');
  });
});

test('update x npm starter contains the wrapper; the upgrade tgz is 0.2.1 with the new behaviour while the repo build is not', async () => {
  await withProject('update-npm', false, async (workspace, files) => {
    expect(files).toEqual(expect.arrayContaining(['src/local-button.tsx', 'upgrade/luca-style-react-0.2.1.tgz']));
    expect(await readFile(join(workspace, 'src/local-button.tsx'), 'utf8')).toContain('data-local-change="orders"');
    expect(await readFile(join(workspace, 'src/main.tsx'), 'utf8')).toContain('LocalButton');
    const unpacked = join(workspace, '..', 'unpacked');
    await mkdir(unpacked);
    expect(spawnSync('tar', ['-xzf', 'luca-style-react-0.2.1.tgz', '-C', '../../unpacked'], { cwd: join(workspace, 'upgrade') }).status).toBe(0);
    expect(JSON.parse(await readFile(join(unpacked, 'package/package.json'), 'utf8')).version).toBe('0.2.1');
    expect(await readFile(join(unpacked, 'package/dist/button.js'), 'utf8')).toContain('"aria-disabled": loading || undefined');
    expect(await repoFile('packages/react/dist/button.js')).not.toContain('aria-disabled');
  });
});

test('crud copy starter type-checks and builds with the copied source, and has no @luca-style/react installed', async () => {
  test.setTimeout(300_000);
  await withProject('crud-copy', true, async workspace => {
    sh('npm', ['run', 'build'], workspace);
    const scoped = await readdir(join(workspace, 'node_modules/@luca-style'));
    expect(copyGroupProblems({ packageJson: await readFile(join(workspace, 'package.json'), 'utf8'), installedReact: scoped.includes('react') })).toEqual([]);
    expect((await readdir(join(workspace, 'node_modules/@types'))).sort()).toEqual(expect.arrayContaining(['react', 'react-dom']));
  });
});

test('update x npm: the starter keeps the local change but lacks the new version; installing the tgz fixes the version and keeps the wrapper', async () => {
  test.setTimeout(300_000);
  await withProject('update-npm', true, async workspace => {
    const grade = () => gradeUpdate({ source: workspace, dist: join(workspace, 'dist'), mode: 'npm' });
    sh('npm', ['run', 'build'], workspace);
    expect((await grade()).update).toEqual({ newVersionInstalled: false, newVersionActive: false, localKept: true, pass: false });
    sh('npm', ['install', '--no-audit', '--no-fund', './upgrade/luca-style-react-0.2.1.tgz'], workspace);
    sh('npm', ['run', 'build'], workspace);
    expect((await grade()).update).toEqual({ newVersionInstalled: true, newVersionActive: true, localKept: true, pass: true });
  });
});

test('update x copy: overwriting with the upstream files loses the local change, merging keeps both', async () => {
  test.setTimeout(300_000);
  await withProject('update-copy', true, async workspace => {
    const grade = () => gradeUpdate({ source: workspace, dist: join(workspace, 'dist'), mode: 'copy' });
    const button = join(workspace, 'src/luca-style/button.tsx');
    sh('npm', ['run', 'build'], workspace);
    expect((await grade()).update).toEqual({ newVersionInstalled: false, newVersionActive: false, localKept: true, pass: false });
    const upstream = await readFile(join(workspace, 'upgrade/react-src/button.tsx'), 'utf8');
    await writeFile(button, upstream);
    sh('npm', ['run', 'build'], workspace);
    expect((await grade()).update).toEqual({ newVersionInstalled: true, newVersionActive: true, localKept: false, pass: false });
    await writeFile(button, applyLocalChange(upstream));
    sh('npm', ['run', 'build'], workspace);
    expect((await grade()).update).toEqual({ newVersionInstalled: true, newVersionActive: true, localKept: true, pass: true });
  });
});

test('hard-coded colors in the copied library source are not counted unless the agent changed that file', async () => {
  await withProject('crud-copy', false, async workspace => {
    const pristine = await pristineLibraryFiles(workspace);
    expect(pristine).toContain('src/luca-style/button.tsx');
    expect(pristine).toContain('src/luca-style/styles.css');
    const before = await gradeProject({ source: workspace, dist: null, ignore: pristine });
    expect(before.hardcodedColors.count).toBe(0);
    // 代理改了 button.tsx 並加進寫死顏色：該檔不再是原樣，要照掃。
    const button = join(workspace, 'src/luca-style/button.tsx');
    await writeFile(button, `${await readFile(button, 'utf8')}\nexport const mine = { color: '#ff0000' };\n`);
    const changed = await pristineLibraryFiles(workspace);
    expect(changed).not.toContain('src/luca-style/button.tsx');
    expect((await gradeProject({ source: workspace, dist: null, ignore: changed })).hardcodedColors.count).toBe(1);
  });
});
