// 複製 vs npm 評測的起始專案（ISSUE-014）：準備工作區、打包自製的「新版」。run.mjs 與 tests/eval-copy-vs-npm.spec.ts 呼叫。
// install 為 false（dry-run、測試）時只建出檔案，不裝依賴；打包仍會做（需要先 npm run build）。
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyLocalChange, applyNewVersion, applyNewVersionDist, newVersion } from './copy-vs-npm.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const evals = join(root, 'evals');
const npmTimeoutMs = 10 * 60_000;

const npmCliPath = () => process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
// 安裝不能受呼叫行程的環境影響：NODE_ENV=production（例如 vite 的 build() 在同一個行程裡設的）或 npm 的 omit 設定會讓 npm 略過 devDependencies，
// 起始專案就缺 @types/react-dom，型別檢查失敗。這裡把這幾個變數拿掉。
export const installEnv = env => Object.fromEntries(Object.entries(env).filter(([key]) => !/^(NODE_ENV|npm_config_(omit|production|only|include))$/i.test(key)));
function npm(args, cwd) {
  const result = spawnSync(process.execPath, [npmCliPath(), ...args], { cwd, encoding: 'utf8', timeout: npmTimeoutMs, killSignal: 'SIGKILL', env: installEnv(process.env) });
  if (result.status !== 0) throw new Error(`npm ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  return result;
}

// 起始專案的種類：後台與 CRUD 題的複製組（crud-copy）、更新題的兩組（update-npm、update-copy）。
export const kinds = ['crud-copy', 'update-npm', 'update-copy'];
export const taskFile = kind => (kind === 'crud-copy' ? 'crud' : kind);
const starterOf = kind => (kind === 'crud-copy' ? 'copy' : kind);

// 「新版」的 @luca-style/react 0.2.1：複製 packages/react 的建置輸出，補丁套在 dist/button.js，版本升為 0.2.1，npm pack。
// 回傳 tgz 的路徑。--ignore-scripts：prepack 會去抓 ../../LICENSE，暫存區裡沒有，所以授權與說明檔自己放。
export async function buildUpgradePackage(temporary, destination) {
  const source = join(root, 'packages', 'react');
  if (!(await stat(join(source, 'dist', 'button.js')).catch(() => null))) throw new Error('沒有 packages/react/dist，請先 npm run build');
  const work = join(temporary, 'upgrade-package');
  await mkdir(work, { recursive: true });
  for (const name of ['dist', 'fonts', 'loading']) await cp(join(source, name), join(work, name), { recursive: true });
  for (const name of ['LICENSE', 'DESIGN.md', 'llms.txt']) await cp(join(root, name), join(work, name));
  const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
  delete manifest.scripts;
  await writeFile(join(work, 'package.json'), `${JSON.stringify({ ...manifest, version: newVersion }, null, 2)}\n`);
  await writeFile(join(work, 'dist', 'button.js'), applyNewVersionDist(await readFile(join(work, 'dist', 'button.js'), 'utf8')));
  await mkdir(destination, { recursive: true });
  const packed = npm(['pack', '--ignore-scripts', '--pack-destination', destination], work).stdout.trim().split(/\r?\n/).at(-1);
  return join(destination, packed);
}

async function packRepoPackages(temporary, names) {
  const packs = join(temporary, 'packs');
  await mkdir(packs, { recursive: true });
  for (const name of names) npm(['pack', '--pack-destination', packs], join(root, 'packages', name));
  return (await readdir(packs)).filter(name => name.endsWith('.tgz')).sort().map(name => join(packs, name));
}

// 準備工作區。回傳 { tarballs }（相對於工作區安裝用的打包檔）。
export async function prepareCopyVsNpmProject(kind, workspace, temporary, { install }) {
  if (!kinds.includes(kind)) throw new Error(`不認得的起始專案：${kind}`);
  await cp(join(evals, 'starters', 'base'), workspace, { recursive: true });
  await cp(join(evals, 'starters', starterOf(kind)), workspace, { recursive: true });
  const copyGroup = kind !== 'update-npm';
  const react = join(root, 'packages', 'react');
  for (const file of ['packages/tokens/dist/tokens.css', 'packages/react/dist/index.js']) {
    if (!(await stat(join(root, file)).catch(() => null))) throw new Error(`沒有 ${file}，請先 npm run build`);
  }
  if (copyGroup) {
    // 保持相對位置：styles.css 用 ../loading/ 找載入動畫，fonts.css 在 fonts/。
    await cp(join(react, 'src'), join(workspace, 'src', 'luca-style'), { recursive: true });
    await cp(join(react, 'loading'), join(workspace, 'src', 'loading'), { recursive: true });
    await cp(join(react, 'fonts'), join(workspace, 'src', 'fonts'), { recursive: true });
    for (const name of ['DESIGN.md', 'llms.txt']) await cp(join(root, name), join(workspace, name));
  }
  const buttonPath = join(workspace, 'src', 'luca-style', 'button.tsx');
  if (kind === 'update-copy') {
    // 舊版加本地改動；新版（upgrade/react-src）是同一份來源加新版補丁、不含本地改動，就像上游發佈的樣子。
    const pristine = await readFile(join(react, 'src', 'button.tsx'), 'utf8');
    await writeFile(buttonPath, applyLocalChange(pristine));
    await cp(join(react, 'src'), join(workspace, 'upgrade', 'react-src'), { recursive: true });
    await writeFile(join(workspace, 'upgrade', 'react-src', 'button.tsx'), applyNewVersion(pristine));
  }
  const tarballs = await packRepoPackages(temporary, copyGroup ? ['tokens'] : ['tokens', 'react']);
  if (kind === 'update-npm') await buildUpgradePackage(temporary, join(workspace, 'upgrade'));
  if (install) {
    const baseUi = JSON.parse(await readFile(join(react, 'package.json'), 'utf8')).dependencies['@base-ui/react'];
    npm(['install', '--no-audit', '--no-fund', ...tarballs.map(path => relative(workspace, path)), ...(copyGroup ? [`@base-ui/react@${baseUi}`] : [])], workspace);
  }
  return { tarballs };
}

export const listFiles = async workspace => (await readdir(workspace, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile())
  .map(entry => relative(workspace, join(entry.parentPath, entry.name)).split(sep).join('/')).filter(file => !file.startsWith('node_modules/') && file !== 'package-lock.json').sort();

// 複製組工作區裡「複製進來、沒被改過」的元件檔（相對路徑）。評分時略過它們：元件庫自己的寫法不算代理寫的；
// 被改過或新增的檔仍然照掃。
export async function pristineLibraryFiles(workspace) {
  const pristine = [];
  const base = join(workspace, 'src', 'luca-style');
  const original = join(root, 'packages', 'react', 'src');
  for (const entry of await readdir(base, { recursive: true, withFileTypes: true }).catch(() => [])) {
    if (!entry.isFile()) continue;
    const path = relative(base, join(entry.parentPath, entry.name));
    const same = await Promise.all([readFile(join(base, path)), readFile(join(original, path))]).then(([a, b]) => Buffer.compare(a, b) === 0, () => false);
    if (same) pristine.push(`src/luca-style/${path.split(sep).join('/')}`);
  }
  return pristine.sort();
}
