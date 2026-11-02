import { expect, test } from '@playwright/test';
import path from 'node:path';

test('real uploads create distinct tasks only through explicit submission', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/tasks')) requests.push(request.method());
  });
  await page.goto('/templates/inspiration-grid');
  await page.getByRole('combobox', { name: '演示身份' }).selectOption('demo-alice');
  await expect(page.getByText('当前身份：小禾', { exact: true })).toBeVisible();
  for (const [index, file] of ['mountain.png', 'coast.png', 'sunset.jpg'].entries()) {
    await page.getByLabel(`图片 ${index + 1}`, { exact: true }).setInputFiles(path.resolve('../assets/demo/inputs', file));
  }
  await expect(page.getByText('上传成功', { exact: true })).toHaveCount(3);
  await page.getByRole('button', { name: '开始制作', exact: true }).click();
  const receipt = page.getByRole('region', { name: '提交回执' });
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText('受理时状态');
  const firstId = await receipt.getByLabel('任务 ID').innerText();
  expect(firstId).toMatch(/^[0-9a-f-]{36}$/);
  await page.getByRole('button', { name: '再次制作', exact: true }).click();
  await expect(receipt.getByLabel('任务 ID')).not.toHaveText(firstId);
  expect(requests).toEqual(['POST', 'POST']);
  await page.getByRole('button', { name: '移除图片 1' }).click();
  await expect(receipt).toHaveCount(0);
});
