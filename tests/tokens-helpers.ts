import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 設計變數產生器與原始檔的位置；測試只透過指令列與輸出檔觀察行為。
export const tokensPackage = fileURLToPath(new URL('../packages/tokens/', import.meta.url));
export const sourceDir = join(tokensPackage, 'src');
export const generator = join(tokensPackage, 'build.mjs');
export const fixtureDir = fileURLToPath(new URL('./fixtures/tokens-0.1.0/', import.meta.url));

// 在暫存目錄複製一份原始檔，讓測試可以改動而不碰 repo 內的檔案。
export async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), 'luca-tokens-'));
  const source = join(root, 'src');
  await cp(sourceDir, source, { recursive: true });
  return { root, source, out: join(root, 'out'), dispose: () => rm(root, { recursive: true, force: true }) };
}

// 以相對於 cwd 的路徑呼叫產生器，同時驗證 --source／--out 依 cwd 解析。
export function runGenerator(cwd: string, source = 'src', out = 'out') {
  const result = spawnSync(process.execPath, [generator, '--source', source, '--out', out], { cwd, encoding: 'utf8' });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

export const readText = async (path: string) => (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
export const readJson = async (path: string) => JSON.parse(await readText(path));

// 走訪目錄下所有 JSON 檔，回傳相對路徑。
export async function listJsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => join(entry.parentPath, entry.name).slice(dir.length + 1).replace(/\\/g, '/')).sort();
}
