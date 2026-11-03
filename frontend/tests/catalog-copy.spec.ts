import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const width of [1440, 390]) {
  test(`catalog copy and material navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/session', (route) => route.fulfill({ status: 401, json: {} }));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '模板库', exact: true })).toBeVisible();
    await expect(page.locator('.catalog-grid a')).not.toHaveCount(0);
    await expect(page.getByText(/^\d+ 个模板$/)).toHaveCount(0);
    const navigation = page.getByRole('navigation', { name: '主导航' });
    await expect(navigation.getByRole('link', { name: '我的素材', exact: true })).toHaveAttribute('href', '/history');
    await expect(navigation.getByRole('link', { name: '我的记录', exact: true })).toHaveCount(0);
    await mkdir('../artifacts/catalog-copy', { recursive: true });
    await page.screenshot({ path: `../artifacts/catalog-copy/${width}.png` });
    await navigation.getByRole('link', { name: '我的素材', exact: true }).click();
    await expect(page).toHaveURL(/\/history$/);
  });
}
