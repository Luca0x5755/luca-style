import { test, expect } from '@playwright/test';
test('developer can enter foundations from the design system Home', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name:/為你的下一個專案，\s*建立一致的起點。/})).toBeVisible();
  await page.getByRole('button', {name:'探索設計基礎 →'}).click();
  await expect(page).toHaveURL(/\/foundations$/);
  await expect(page.getByRole('heading', {name:'設計基礎', exact:true})).toBeVisible();
});
