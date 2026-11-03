import { test, expect } from '@playwright/test';

test('choose, restore, switch and leave a demo identity', async ({ page }) => {
  await page.goto('/');
  const identity = page.getByRole('combobox', { name: '演示身份' });
  await expect(identity).toBeEnabled();
  await expect(page.getByText('尚未选择身份', { exact: true })).toHaveCount(0);
  await identity.selectOption('demo-alice');
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveValue('demo-alice');
  await page.reload();
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveValue('demo-alice');
  await identity.selectOption('demo-bob');
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveValue('demo-bob');
  await page.getByRole('button', { name: '退出身份', exact: true }).click();
  await expect(identity).toBeEnabled();
  await expect(identity).toHaveValue('');
  await expect(page.getByRole('button', { name: '退出身份', exact: true })).toHaveCount(0);
  await expect(page.getByText('尚未选择身份', { exact: true })).toHaveCount(0);
});

test('failed identity mutation rechecks the session before enabling private writes', async ({ page }) => {
  await page.goto('/templates/mountain-card');
  await page.getByRole('combobox', { name: '演示身份' }).selectOption('demo-alice');
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveValue('demo-alice');
  await page.route('**/api/session', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: '身份切换暂时不可用' } });
  });
  await page.getByRole('combobox', { name: '演示身份' }).selectOption('demo-bob');
  await expect(page.getByText(/已重新确认当前身份/)).toBeVisible();
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveValue('demo-alice');
  await expect(page.getByRole('region', { name: '制作区域', exact: true })
    .getByLabel('图片 1', { exact: true })).toBeEnabled();
});
