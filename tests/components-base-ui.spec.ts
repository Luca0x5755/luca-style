import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// ISSUE-010：其餘互動元件改由 Base UI 處理（PR-STYLE-38）。
// 「用了函式庫」只能從原始碼看出：檢查每個有對應的元件從對應的 @base-ui/react 子路徑匯入，且不再直接渲染原生控制項。
// 先去掉註解，免得註解裡提到的標籤被當成實際渲染。
const source = async (name: string) => (await readFile(new URL(`../packages/react/src/${name}`, import.meta.url), 'utf8')).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

test('Button is built on the Base UI Button', async () => {
  const code = await source('button.tsx');
  expect(code).toMatch(/from '@base-ui\/react\/button'/);
  expect(code).not.toMatch(/<button[\s>]/);
});

test('TextField is built on the Base UI Input', async () => {
  const code = await source('controls.tsx');
  expect(code).toMatch(/from '@base-ui\/react\/input'/);
  expect(code).not.toMatch(/<input[\s>]/);
});

test('Checkbox is built on the Base UI Checkbox with no native checkbox input', async () => {
  const code = await source('controls.tsx');
  expect(code).toMatch(/from '@base-ui\/react\/checkbox'/);
  expect(code).not.toMatch(/type="checkbox"/);
});

test('Navigation is built on the Base UI NavigationMenu', async () => {
  const code = await source('data-display.tsx');
  expect(code).toMatch(/from '@base-ui\/react\/navigation-menu'/);
});
