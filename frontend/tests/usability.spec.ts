import { expect, test } from '@playwright/test';
import { gate, mountain, openCreation, readyImage } from './helpers';
import { taskFixture } from './fixtures/tasks';
import { readFile } from 'node:fs/promises';

test('upload validation describes requirements and removal returns keyboard focus to the input', async ({ page }) => {
  await openCreation(page);
  const input = page.getByRole('region', { name: '制作区域', exact: true }).getByLabel('图片 1', { exact: true });
  await input.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(input).toHaveAccessibleDescription(/JPEG.*PNG.*5 MiB/);
  await readyImage(page);
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');
  const remove = page.getByRole('button', { name: '移除图片 1', exact: true });
  await remove.focus();
  await page.keyboard.press('Enter');
  await expect(input).toBeFocused();
  await expect(page.getByText('尚未上传', { exact: true })).toBeVisible();
});

test('empty history waits for unfinished-task recovery and does not hide its failure', async ({ page }) => {
  const active = gate();
  let unavailable = true;
  await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill({ json: { items: [], nextCursor: null } }));
  await page.route('**/api/tasks/active', async (route) => {
    await active.promise;
    await route.fulfill(unavailable
      ? { status: 503, json: { code: 'UNAVAILABLE', message: '恢复接口暂时不可用' } }
      : { json: { items: [] } });
  });
  await openCreation(page);
  const history = page.getByRole('region', { name: '本模板记录', exact: true });
  await expect(history.getByRole('button', { name: '刷新记录', exact: true })).toBeEnabled();
  await expect(history.getByText('正在恢复未完成任务…', { exact: true })).toBeVisible();
  await expect(history.getByText(/还没有制作记录/)).toHaveCount(0);
  active.release();
  const retry = history.getByRole('button', { name: '重试恢复未完成任务', exact: true });
  await expect(retry).toBeVisible();
  await expect(history.getByText(/还没有制作记录/)).toHaveCount(0);
  unavailable = false;
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(history.getByText(/还没有制作记录/)).toBeVisible();
  await expect(history.getByRole('heading', { name: '本模板记录', exact: true })).toBeFocused();
});

test('history retry keeps a stable focus target after the retry button disappears', async ({ page }) => {
  let unavailable = true;
  await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill(unavailable
    ? { status: 503, json: { code: 'UNAVAILABLE', message: '历史读取失败' } }
    : { json: { items: [], nextCursor: null } }));
  await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [] } }));
  await openCreation(page);
  const history = page.getByRole('region', { name: '本模板记录', exact: true });
  const retry = history.getByRole('button', { name: '重新加载记录', exact: true });
  await expect(retry).toBeVisible();
  unavailable = false;
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(history.getByText(/还没有制作记录/)).toBeVisible();
  await expect(history.getByRole('heading', { name: '本模板记录', exact: true })).toBeFocused();
});

test('keyboard can choose a file and retry its upload without losing focus', async ({ page }) => {
  let unavailable = true;
  await page.route('**/api/assets', (route) => unavailable
    ? route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: '上传暂时不可用' } })
    : route.continue());
  await openCreation(page);
  const input = page.getByRole('region', { name: '制作区域', exact: true }).getByLabel('图片 1', { exact: true });
  await input.focus();
  const picker = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await picker).setFiles(mountain);
  const retry = page.getByRole('button', { name: '重试上传图片 1', exact: true });
  await expect(retry).toBeVisible();
  unavailable = false;
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('上传成功', { exact: true })).toBeVisible();
  await expect(input).toBeFocused();
});

test('result retry keeps keyboard focus in the preview after its button disappears', async ({ page }) => {
  const task = taskFixture(81, { status: 'SUCCEEDED', version: 6, stage: 'RESULT_FINALIZATION',
    finishedAt: '2026-11-02T06:00:03Z', resultUrl: '/demo/results/mountain-card.svg' });
  await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill({ json: { items: [task], nextCursor: null } }));
  await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [] } }));
  let unavailable = true;
  await page.route('**/demo/results/mountain-card.svg', (route) => unavailable ? route.fulfill({ status: 500 }) : route.continue());
  await openCreation(page);
  const retry = page.getByRole('button', { name: '重新加载图片', exact: true });
  await expect(retry).toBeVisible();
  unavailable = false;
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('img', { name: '山野明信片制作结果', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: '山野明信片结果预览', exact: true })).toBeFocused();
});

for (const [templateId, count] of [['travel-duo', 2], ['inspiration-grid', 3]] as const) {
  test(`${count} uploads with long filenames can be submitted by keyboard on a small screen`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/templates/${templateId}`);
    await page.getByRole('combobox', { name: '演示身份' }).selectOption('demo-alice');
    await expect(page.getByText('当前身份：小禾', { exact: true })).toBeVisible();
    for (let index = 1; index <= count; index++) {
      await page.getByLabel(`图片 ${index}`, { exact: true }).setInputFiles({
        name: `${'long-travel-photo-'.repeat(8)}${index}.png`, mimeType: 'image/png', buffer: await readFile(mountain),
      });
    }
    await expect(page.getByText('上传成功', { exact: true })).toHaveCount(count);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const submit = page.getByRole('button', { name: '开始制作', exact: true });
    await submit.focus();
    await page.keyboard.press('Enter');
    const receipt = page.getByRole('region', { name: '提交回执' });
    await expect(receipt).toBeVisible();
    const id = await receipt.getByLabel('任务 ID').innerText();
    await expect(page.getByRole('article', { name: `任务 ${id}`, exact: true }).getByRole('img')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
