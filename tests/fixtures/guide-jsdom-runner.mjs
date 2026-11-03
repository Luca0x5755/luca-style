// 接入文件的程式碼片段執行器：在獨立子行程用 jsdom 執行一段 TS／TSX 原始碼（ISSUE-009）。
// 用法：node guide-jsdom-runner.mjs <原始碼檔>。放在子行程是為了不讓 jsdom 的全域變數汙染 Playwright 的測試行程。
// 片段裡的 expect 由這裡提供（只含片段會用到的比對），語意與 Vitest、Jest 相同，讀者貼進自己的測試框架即可。
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {JSDOM} from 'jsdom';
import ts from 'typescript';

const [file] = process.argv.slice(2);
const dom = new JSDOM('<!doctype html><html><body></body></html>', {pretendToBeVisual: true, runScripts: 'outside-only', url: 'http://localhost/'});
// Node 已有的全域（例如 navigator）也要換成 jsdom 的；其餘 jsdom 有而 Node 沒有的一併補上。
for (const key of ['window', 'document', 'navigator']) Object.defineProperty(globalThis, key, {value: dom.window[key], configurable: true, writable: true});
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (key in globalThis || key.startsWith('_')) continue;
  try { Object.defineProperty(globalThis, key, {value: dom.window[key], configurable: true, writable: true}); } catch { /* 少數屬性不可定義，片段用不到。 */ }
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = globalThis.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}});

const subject = value => ({
  toBe: expected => assert.strictEqual(value, expected),
  toEqual: expected => assert.deepStrictEqual(value, expected),
  toBeNull: () => assert.strictEqual(value, null),
  toContain: expected => assert.ok(value.includes(expected), `${JSON.stringify(value)} 不含 ${JSON.stringify(expected)}`),
});
globalThis.expect = subject;

// 轉成 ESM 再 import，片段才能用頂層 await；檔案放在 repo 內，裸模組名稱才解析得到 node_modules。
const output = ts.transpileModule(readFileSync(file, 'utf8'), {fileName: 'snippet.tsx', compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText;
const compiled = `${file}.mjs`;
writeFileSync(compiled, output);
try {
  await import(pathToFileURL(compiled).href);
  console.log('SNIPPET OK');
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
