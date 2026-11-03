import { expect, test } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { mountain } from './helpers';

test('compact upload card wraps long names and retains failure recovery on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.route('**/api/session', (route) => route.fulfill({ json: { id: 'demo-alice', displayName: '小禾' } }));
  await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [] } }));
  await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill({ json: { items: [], nextCursor: null } }));
  let attempts = 0;
  await page.route('**/api/assets', (route) => {
    attempts += 1;
    return attempts === 1
      ? route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: '上传服务暂时不可用' } })
      : route.fulfill({ status: 201, json: {
        id: '00000000-0000-4000-8000-000000000998', originalName: 'image.png',
        mimeType: 'image/png', sizeBytes: 100, previewUrl: '/api/assets/mock/content',
      } });
  });
  await page.goto('/templates/travel-duo');
  const slot = page.getByRole('group', { name: '图片 1', exact: true });
  const input = slot.getByLabel('图片 1', { exact: true });
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveValue('demo-alice');
  await expect(input).toBeEnabled();
  const name = '这是一张需要保留完整文件名并且能够自动换行的山野风景图片.png';
  await input.setInputFiles({ name, mimeType: 'image/png', buffer: await readFile(mountain) });
  const error = slot.getByRole('alert');
  await expect(error).toHaveText('上传服务暂时不可用');
  const filename = slot.getByText(name, { exact: true });
  const bounds = (await filename.boundingBox())!;
  const card = (await slot.boundingBox())!;
  expect(bounds.x + bounds.width).toBeLessThan(card.x + card.width);
  expect(bounds.height).toBeGreaterThan(30);
  await slot.getByRole('button', { name: '重试上传图片 1', exact: true }).click();
  await expect(slot.getByText('上传成功', { exact: true })).toBeVisible();
  await expect(input).toBeFocused();
  await expect(error).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await mkdir('../artifacts/upload-compact', { recursive: true });
  await slot.screenshot({ path: '../artifacts/upload-compact/long-name-390.png' });
  await slot.getByRole('button', { name: '移除图片 1', exact: true }).click();
  await expect(input).toBeFocused();
  const picker = page.waitForEvent('filechooser');
  await slot.click({ position: { x: 8, y: 60 } });
  await (await picker).setFiles(mountain);
  await expect(slot.getByText('上传成功', { exact: true })).toBeVisible();
  const secondSlot = page.getByRole('group', { name: '图片 2', exact: true });
  expect((await slot.boundingBox())!.height).toBe((await secondSlot.boundingBox())!.height);
  await page.getByRole('region', { name: '制作区域', exact: true }).screenshot({
    path: '../artifacts/upload-compact/equal-height-390.png',
  });
});
