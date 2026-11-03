import { expect, test } from '@playwright/test';
import { chooseIdentity, mountain, openCreation, readyImage } from './helpers';
import { taskFixture } from './fixtures/tasks';

test('file size and empty content are rejected locally; upload failure can retry', async ({ page }) => {
  await openCreation(page);
  const fileInput = page.getByLabel('图片 1', { exact: true });
  const slot = page.getByRole('group', { name: '图片 1', exact: true });
  let requests = 0;
  await page.route('**/api/assets', async (route) => {
    requests += 1;
    if (requests === 1) return route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: '上传服务暂时不可用' } });
    await route.continue();
  });
  await fileInput.setInputFiles({ name: 'empty.png', mimeType: 'image/png', buffer: Buffer.alloc(0) });
  await expect(slot.getByRole('alert')).toContainText('内容为空');
  await fileInput.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(slot.getByRole('alert')).toContainText('超过 5 MiB');
  expect(requests).toBe(0);
  await fileInput.setInputFiles(mountain);
  await expect(slot.getByRole('alert')).toContainText('上传服务暂时不可用');
  await page.getByRole('button', { name: '重试上传图片 1', exact: true }).click();
  await expect(page.getByText('上传成功', { exact: true })).toBeVisible();
  expect(requests).toBe(2);
});

test('expired session clears assets and requires choosing identity again', async ({ page, context }) => {
  await openCreation(page);
  await readyImage(page);
  await context.clearCookies();
  await page.getByRole('button', { name: '开始制作', exact: true }).click();
  await expect(page.getByText('会话已失效，请重新选择身份。', { exact: true })).toBeVisible();
  await expect(page.getByText('已选 0 / 1 张', { exact: true })).toBeVisible();
  const input = page.getByLabel('图片 1', { exact: true });
  await expect(input).toBeEnabled();
  await expect(page.getByRole('button', { name: '开始制作', exact: true })).toBeDisabled();
  let choosers = 0;
  page.on('filechooser', () => { choosers += 1; });
  await input.click();
  const prompt = page.getByRole('dialog', { name: '请先选择身份', exact: true });
  await expect(prompt).toBeVisible();
  expect(choosers).toBe(0);
  await prompt.getByRole('button', { name: '去选择身份', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '演示身份' })).toBeFocused();
  await chooseIdentity(page, 'demo-bob');
  await expect(page.getByText('已选 0 / 1 张', { exact: true })).toBeVisible();
  await readyImage(page);
  await expect(page.getByRole('button', { name: '开始制作', exact: true })).toBeEnabled();
});

test('uncertain submission retains files and retries only on explicit user action', async ({ page }) => {
  await openCreation(page);
  await readyImage(page);
  let writes = 0;
  await page.route('**/api/tasks', async (route) => {
    writes += 1;
    // A successful write with an unreadable acknowledgement is still uncertain.
    if (writes === 1) {
      await route.fetch();
      return route.fulfill({ status: 202, json: { id: 'incomplete-response' } });
    }
    await route.continue();
  });
  await page.getByRole('button', { name: '开始制作', exact: true }).click();
  await expect(page.getByRole('region', { name: '制作区域' }).getByRole('alert')).toContainText('任务可能已创建');
  await expect(page.getByText('上传成功', { exact: true })).toBeVisible();
  expect(writes).toBe(1);
  await page.getByRole('button', { name: '再次创建（可能重复）', exact: true }).click();
  await expect(page.getByRole('region', { name: '提交回执' })).toBeVisible();
  expect(writes).toBe(2);
});

test('202 failed task is registered and displays its scheduling failure in history', async ({ page }) => {
  await openCreation(page);
  await readyImage(page);
  const task = taskFixture(300, {
    status: 'FAILED', version: 1, finishedAt: '2026-11-02T06:01:00Z',
    failure: { code: 'EXECUTOR_REJECTED', stage: null, message: '执行队列已满' },
  });
  await page.route('**/api/tasks', (route) => route.fulfill({ status: 202, json: task }));
  await page.getByRole('button', { name: '开始制作', exact: true }).click();
  const receipt = page.getByRole('region', { name: '提交回执' });
  await expect(receipt).toContainText('任务已登记');
  const card = page.getByRole('article', { name: `任务 ${task.id}`, exact: true });
  await expect(card).toContainText('制作失败');
  await expect(card).toContainText('执行队列已满');
});
