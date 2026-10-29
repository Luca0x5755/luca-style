import { test, expect } from '@playwright/test';
import type { ButtonProps, CheckboxProps, TextFieldProps } from '../packages/react/src/index.js';
import { buildHarness, origin, serveHarness } from './theme-harness';

// ISSUE-010：Button、TextField、Checkbox 改用 Base UI 後，0.1.0 的公開 props 仍可用（PR-STYLE-40）。
// 做不到的地方記在 docs/consumer-guide.md 的 0.2.0 升級說明。

// 編譯期相容檢查：0.1.0 的常用寫法仍可編譯；onChange 仍帶 event.target.value／checked。
const acceptsButton = (props:ButtonProps) => props;
acceptsButton({variant:'secondary', loading:true, type:'submit', disabled:false, className:'x', title:'提示', 'aria-label':'名稱', onClick:event => event.currentTarget.blur(), onFocus:() => undefined});
const acceptsText = (props:TextFieldProps) => props;
acceptsText({label:'欄位', id:'a', name:'a', value:'v', defaultValue:'v', helper:'說明', error:'錯誤', placeholder:'p', maxLength:3, required:true, disabled:false, readOnly:true, autoComplete:'off', type:'email', inputMode:'numeric', 'aria-describedby':'n',
  onChange:event => { const value:string = event.target.value; return value; }, onBlur:() => undefined});
const acceptsCheckbox = (props:CheckboxProps) => props;
acceptsCheckbox({label:'核取', id:'c', name:'c', value:'yes', checked:true, defaultChecked:false, helper:'說明', error:'錯誤', required:true, disabled:false, readOnly:false, form:'f', className:'x', 'aria-describedby':'n',
  onChange:event => { const checked:boolean = event.target.checked; return checked; }, onFocus:() => undefined});

test.describe('0.1.0 props on the ThemeProvider harness', () => {
  let outDir = '';
  test.beforeAll(async () => { outDir = await buildHarness(); });

  test('TextField keeps controlled value, events, helper, error, description, data attribute and class', async ({ page }) => {
    await serveHarness(page, outDir);
    await page.goto(`${origin}/?persist=0`);
    const form = page.getByRole('form', { name:'控制項相容性' });
    const field = form.getByLabel('受控欄位');
    await expect(field).toHaveValue('初值');
    await expect(field).toHaveAttribute('data-sample', 'text');
    await expect(field).toHaveAttribute('placeholder', '輸入');
    await expect(field).toHaveAccessibleDescription('提示文字');
    await field.fill('新值');
    await expect(form.getByLabel('欄位值')).toHaveText('新值');
    await field.blur();
    await expect(form.getByLabel('事件紀錄')).toContainText('欄位 focus,欄位 blur');
    await expect(form.getByLabel('預設值欄位')).toHaveValue('甲');
    await expect(form.getByLabel('預設值欄位')).toHaveClass(/luca-input extra/);
    const invalid = form.getByLabel('錯誤欄位');
    await expect(invalid).toHaveAttribute('aria-invalid', 'true');
    await expect(invalid).toHaveAccessibleDescription('補充說明 格式不對');
  });

  test('Checkbox keeps controlled checked, onChange target.checked, name and value in the form, disabled, description and data attribute', async ({ page }) => {
    await serveHarness(page, outDir);
    await page.goto(`${origin}/?persist=0`);
    const form = page.getByRole('form', { name:'控制項相容性' });
    const box = form.getByRole('checkbox', { name:'受控核取' });
    await expect(box).not.toBeChecked();
    await expect(box).toHaveAttribute('data-sample', 'box');
    await expect(box).toHaveAccessibleDescription('勾選說明');
    await box.click();
    await expect(box).toBeChecked();
    await expect(form.getByLabel('核取值')).toHaveText('true');
    await expect(form.getByLabel('事件紀錄')).toContainText('核取 focus');
    await expect(form.getByRole('checkbox', { name:'預設勾選' })).toBeChecked();
    await expect(form.getByRole('checkbox', { name:'預設勾選' })).toHaveClass(/luca-checkbox-box extra/);
    await expect(form.getByRole('checkbox', { name:'停用核取' })).toBeDisabled();
    const invalid = form.getByRole('checkbox', { name:'錯誤核取' });
    await expect(invalid).toHaveAttribute('aria-invalid', 'true');
    await expect(invalid).toHaveAccessibleDescription('補充說明 必須勾選');
    // 點文字也能切換，與原生 label 相同。
    await form.getByText('錯誤核取', { exact:true }).click();
    await expect(invalid).toBeChecked();
    // 送出：只有有 name 且未停用的項目進入表單（title、勾選的 agree、預設勾選的 opt；value 沒給時為 on，停用的 off 不送出）。
    await form.getByRole('button', { name:'送出控制項' }).click();
    expect(JSON.parse(await form.getByLabel('控制項送出內容').innerText())).toEqual([['title', '初值'], ['agree', 'yes'], ['opt', 'on']]);
  });

  test('Button keeps type, variant class, extra class, title, data attribute, onClick and busy state', async ({ page }) => {
    await serveHarness(page, outDir);
    await page.goto(`${origin}/?persist=0`);
    const form = page.getByRole('form', { name:'控制項相容性' });
    const submit = form.getByRole('button', { name:'送出控制項' });
    await expect(submit).toHaveAttribute('type', 'submit');
    await expect(submit).toHaveAttribute('data-sample', 'button');
    await expect(submit).toHaveClass(/luca-button luca-button-primary/);
    const secondary = form.getByRole('button', { name:'次要', exact:true });
    await expect(secondary).toHaveClass(/luca-button luca-button-secondary extra/);
    await expect(secondary).toHaveAttribute('title', '次要提示');
    await expect(secondary).toHaveAttribute('type', 'button');
    const busy = form.getByRole('button', { name:'處理' });
    await expect(busy).toBeDisabled();
    await expect(busy).toHaveAttribute('aria-busy', 'true');
    await submit.click();
    await expect(form.getByLabel('事件紀錄')).toContainText('按鈕 click');
  });
});
