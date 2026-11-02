import { test, expect } from '@playwright/test';
import { readyImage } from './helpers';

for (const width of [1440, 768, 390]) {
  test(`usable catalog and creation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 900 });
    await page.goto('/');
    await expect(page.getByRole('link', { name: /山野明信片/ })).toBeVisible();
    await expect(page.getByRole('combobox', { name: '演示身份' })).toBeEnabled();
    await page.screenshot({ path: `../artifacts/phase-3/catalog-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: /山野明信片/ }).click();
    await page.getByRole('combobox', { name: '演示身份' }).selectOption('demo-alice');
    await expect(page.getByText('当前身份：小禾', { exact: true })).toBeVisible();
    await readyImage(page);
    const submit = page.getByRole('button', { name: '开始制作', exact: true });
    await submit.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: '提交回执' })).toBeVisible();
    await page.screenshot({ path: `../artifacts/phase-3/creation-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
