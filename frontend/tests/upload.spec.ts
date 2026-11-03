import { chooseIdentity } from './helpers';
import { test, expect } from '@playwright/test';
import path from 'node:path';

const mountain = path.resolve('../assets/demo/inputs/mountain.png');
const coast = path.resolve('../assets/demo/inputs/coast.png');

test('template upload slots validate, preview, replace and remove real files', async ({ page }) => {
  await page.goto('/templates/travel-duo');
  await chooseIdentity(page, 'demo-alice');
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveText('小禾');
  const submit = page.getByRole('button', { name: '开始制作', exact: true });
  await expect(submit).toBeDisabled();
  await page.getByLabel('图片 1', { exact: true }).setInputFiles(mountain);
  await expect(page.getByText('上传成功', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('img', { name: '图片 1 预览' })).toBeVisible();
  await expect(submit).toBeDisabled();
  await page.getByLabel('图片 2', { exact: true }).setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('group', { name: '图片 2', exact: true }).getByRole('alert')).toContainText('JPEG / PNG');
  await page.getByLabel('图片 2', { exact: true }).setInputFiles(coast);
  await expect(page.getByText('上传成功', { exact: true })).toHaveCount(2);
  await expect(submit).toBeEnabled();
  await page.getByRole('button', { name: '移除图片 1' }).click();
  await expect(submit).toBeDisabled();
  await expect(page.getByRole('img', { name: '图片 1 预览' })).toHaveCount(0);
  await page.getByLabel('图片 1', { exact: true }).setInputFiles(coast);
  await expect(page.getByText('上传成功', { exact: true })).toHaveCount(2);
  await page.getByLabel('图片 1', { exact: true }).setInputFiles(mountain);
  await expect(page.getByText('mountain.png', { exact: true })).toBeVisible();
  await expect(page.getByText('上传成功', { exact: true })).toHaveCount(2);
  await submit.click();
  const id = await page.getByRole('region', { name: '提交回执' }).getByLabel('任务 ID').innerText();
  await expect(page.getByRole('article', { name: `任务 ${id}`, exact: true })).toContainText('海边双拼');
});
