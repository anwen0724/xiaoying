import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('materials loading shell uses the current material naming', async ({ request }) => {
  const response = await request.get('/history');
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain('aria-label="正在加载素材页面"');
  expect(html).toContain('正在加载素材…');
  expect(html).not.toContain('我的制作记录');
  expect(html).not.toContain('正在加载记录页面');
});

for (const width of [1440, 390, 320]) {
  test(`main navigation identifies the current section at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/session', (route) => route.fulfill({ status: 401, json: {} }));
    await page.goto('/');
    await expect(page.getByRole('combobox', { name: '演示身份' })).toBeEnabled();
    const nav = page.getByRole('navigation', { name: '主导航' });
    const catalog = nav.getByRole('link', { name: '模板库', exact: true });
    const materials = nav.getByRole('link', { name: '我的素材', exact: true });
    await expect(catalog).toHaveAttribute('aria-current', 'page');
    await expect(materials).not.toHaveAttribute('aria-current');
    await expect(catalog).toHaveCSS('font-size', '16px');
    await expect(catalog).toHaveCSS('font-weight', '600');
    expect((await page.getByRole('banner').boundingBox())!.height).toBe(width > 1000 ? 65 : 113);
    if (width > 1000) {
      const brand = (await page.getByRole('link', { name: '小影素材制作，返回模板库' }).boundingBox())!;
      expect((await nav.boundingBox())!.x - brand.x - brand.width).toBe(40);
    }
    await mkdir('../artifacts/main-navigation', { recursive: true });
    await page.screenshot({ path: `../artifacts/main-navigation/catalog-${width}.png`, animations: 'disabled' });
    await materials.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/history$/);
    await expect(materials).toHaveAttribute('aria-current', 'page');
    await expect(catalog).not.toHaveAttribute('aria-current');
    await page.getByRole('link', { name: '创意设计', exact: true }).click();
    await expect(materials).toHaveAttribute('aria-current', 'page');
    await page.reload();
    await expect(materials).toHaveAttribute('aria-current', 'page');
    await page.screenshot({ path: `../artifacts/main-navigation/materials-${width}.png`, animations: 'disabled' });
    await catalog.click();
    await page.getByRole('link', { name: /山野明信片/ }).click();
    await expect(catalog).toHaveAttribute('aria-current', 'location');
    await expect(materials).not.toHaveAttribute('aria-current');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
