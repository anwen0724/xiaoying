import { expect, test } from '@playwright/test';
import { chooseIdentity, gate, mountain, openCreation, readyImage } from './helpers';
import { taskFixture } from './fixtures/tasks';
import { mkdir, readFile } from 'node:fs/promises';

for (const width of [1440, 390]) {
  test(`empty upload area opens the file chooser across its surface at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/templates/mountain-card');
    const form = page.getByRole('region', { name: '制作区域', exact: true });
    const slot = form.getByRole('group', { name: '图片 1', exact: true });
    const input = form.getByLabel('图片 1', { exact: true });
    await expect(page.getByRole('combobox', { name: '演示身份' })).toBeEnabled();
    await expect(input).toBeEnabled();
    let chooserCount = 0;
    page.on('filechooser', () => { chooserCount += 1; });
    const bounds = await slot.boundingBox();
    if (!bounds) throw new Error('Upload area is not visible');
    await page.mouse.click(bounds.x + 8, bounds.y + bounds.height / 2);
    const prompt = page.getByRole('dialog', { name: '请先选择身份', exact: true });
    await expect(prompt).toBeVisible();
    expect(chooserCount).toBe(0);
    await prompt.getByRole('button', { name: '取消', exact: true }).click();
    await chooseIdentity(page, 'demo-alice');
    await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveText('小禾');
    await expect(input).toBeEnabled();

    // Test the border padding, icon/text area and lower padding through real clicks.
    for (const [x, y] of [[8, bounds.height / 2], [bounds.width / 2, 50], [bounds.width - 8, bounds.height - 8]]) {
      const picker = page.waitForEvent('filechooser', { timeout: 2000 });
      await slot.click({ position: { x, y } });
      await (await picker).setFiles([]);
    }
    const picker = page.waitForEvent('filechooser');
    await slot.click({ position: { x: 8, y: bounds.height / 2 } });
    await (await picker).setFiles(mountain);
    await expect(form.getByText('上传成功', { exact: true })).toBeVisible();
    await expect(form.getByRole('button', { name: '开始制作', exact: true })).toBeEnabled();
    const replacement = page.waitForEvent('filechooser');
    await form.getByText('替换图片', { exact: true }).click();
    await (await replacement).setFiles(mountain);
    await expect(form.getByText('上传成功', { exact: true })).toBeVisible();
    const beforeRemoval = chooserCount;
    await form.getByRole('button', { name: '移除图片 1', exact: true }).click();
    expect(chooserCount).toBe(beforeRemoval);
    await expect(input).toBeFocused();
    await expect(form.getByText('尚未上传', { exact: true })).toBeVisible();
    await mkdir('../artifacts/upload-click', { recursive: true });
    await form.screenshot({ path: `../artifacts/upload-click/empty-focused-${width}.png` });
  });
}

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
  const history = page.getByRole('region', { name: '历史素材', exact: true });
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
  await expect(history.getByRole('heading', { name: '历史素材', exact: true })).toBeFocused();
});

test('history retry keeps a stable focus target after the retry button disappears', async ({ page }) => {
  let unavailable = true;
  await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill(unavailable
    ? { status: 503, json: { code: 'UNAVAILABLE', message: '历史读取失败' } }
    : { json: { items: [], nextCursor: null } }));
  await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [] } }));
  await openCreation(page);
  const history = page.getByRole('region', { name: '历史素材', exact: true });
  const retry = history.getByRole('button', { name: '重新加载记录', exact: true });
  await expect(retry).toBeVisible();
  unavailable = false;
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(history.getByText(/还没有制作记录/)).toBeVisible();
  await expect(history.getByRole('heading', { name: '历史素材', exact: true })).toBeFocused();
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
    await chooseIdentity(page, 'demo-alice');
    await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveText('小禾');
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
