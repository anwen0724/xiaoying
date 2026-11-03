import { chooseIdentity } from './helpers';
import { test, expect } from '@playwright/test';

test('choose, restore, switch and leave a demo identity', async ({ page }) => {
  await page.goto('/');
  const identity = page.getByRole('combobox', { name: '演示身份' });
  await expect(identity).toBeEnabled();
  await expect(page.getByText('尚未选择身份', { exact: true })).toHaveCount(0);
  await chooseIdentity(page, 'demo-alice');
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveText('小禾');
  await page.reload();
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveText('小禾');
  await chooseIdentity(page, 'demo-bob');
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveText('阿远');
  await page.getByRole('button', { name: '退出身份', exact: true }).click();
  await expect(identity).toBeEnabled();
  await expect(identity).toHaveText('选择身份');
  await expect(page.getByRole('button', { name: '退出身份', exact: true })).toHaveCount(0);
  await expect(page.getByText('尚未选择身份', { exact: true })).toHaveCount(0);
});

test('failed identity mutation rechecks the session before enabling private writes', async ({ page }) => {
  await page.goto('/templates/mountain-card');
  await chooseIdentity(page, 'demo-alice');
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveText('小禾');
  await page.route('**/api/session', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: '身份切换暂时不可用' } });
  });
  await chooseIdentity(page, 'demo-bob');
  await expect(page.getByText(/已重新确认当前身份/)).toBeVisible();
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveText('小禾');
  await expect(page.getByRole('region', { name: '制作区域', exact: true })
    .getByLabel('图片 1', { exact: true })).toBeEnabled();
});
