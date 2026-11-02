import { test, expect } from '@playwright/test';

test('choose, restore, switch and leave a demo identity', async ({ page }) => {
  await page.goto('/');
  const identity = page.getByRole('combobox', { name: '演示身份' });
  await expect(identity).toBeEnabled();
  await identity.selectOption('demo-alice');
  await expect(page.getByText('当前身份：小禾', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('当前身份：小禾', { exact: true })).toBeVisible();
  await identity.selectOption('demo-bob');
  await expect(page.getByText('当前身份：阿远', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '退出身份', exact: true }).click();
  await expect(page.getByText('尚未选择身份', { exact: true })).toBeVisible();
});

test('failed identity mutation rechecks the session before enabling private writes', async ({ page }) => {
  await page.goto('/templates/mountain-card');
  await page.getByRole('combobox', { name: '演示身份' }).selectOption('demo-alice');
  await expect(page.getByText('当前身份：小禾', { exact: true })).toBeVisible();
  await page.route('**/api/session', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: '身份切换暂时不可用' } });
  });
  await page.getByRole('combobox', { name: '演示身份' }).selectOption('demo-bob');
  await expect(page.getByText(/已重新确认当前身份/)).toBeVisible();
  await expect(page.getByText('当前身份：小禾', { exact: true })).toBeVisible();
  await expect(page.getByLabel('图片 1', { exact: true })).toBeEnabled();
});
