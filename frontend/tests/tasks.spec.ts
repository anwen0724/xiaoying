import { expect, test } from '@playwright/test';
import { coast, openCreation, readyImage } from './helpers';

test('each accepted task remains visible after the next submission and material removal', async ({ page }) => {
  await openCreation(page);
  await readyImage(page);
  await page.getByRole('button', { name: '开始制作', exact: true }).click();
  const firstId = await page.getByRole('region', { name: '提交回执' }).getByLabel('任务 ID').innerText();
  await page.getByRole('button', { name: '再次制作', exact: true }).click();
  const receiptId = page.getByRole('region', { name: '提交回执' }).getByLabel('任务 ID');
  await expect(receiptId).not.toHaveText(firstId);
  const secondId = await receiptId.innerText();
  await page.getByRole('button', { name: '移除图片 1' }).click();
  const history = page.getByRole('region', { name: '本模板记录', exact: true });
  await expect(history.getByRole('article', { name: `任务 ${firstId}`, exact: true })).toBeVisible();
  await expect(history.getByRole('article', { name: `任务 ${secondId}`, exact: true })).toBeVisible();
});

test('records survive refresh and personal history includes other templates', async ({ page }) => {
  await openCreation(page);
  await readyImage(page);
  await page.getByRole('button', { name: '开始制作', exact: true }).click();
  const id = await page.getByRole('region', { name: '提交回执' }).getByLabel('任务 ID').innerText();
  await page.reload();
  await expect(page.getByRole('article', { name: `任务 ${id}`, exact: true })).toBeVisible();
  await page.getByRole('link', { name: '模板库', exact: true }).click();
  await page.getByRole('link', { name: /海边双拼/ }).click();
  await expect(page.getByRole('article', { name: `任务 ${id}`, exact: true })).toHaveCount(0);
  await readyImage(page);
  await page.getByLabel('图片 2', { exact: true }).setInputFiles(coast);
  await expect(page.getByText('上传成功', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: '开始制作', exact: true }).click();
  const otherId = await page.getByRole('region', { name: '提交回执' }).getByLabel('任务 ID').innerText();
  await page.getByRole('link', { name: '我的记录', exact: true }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole('article', { name: `任务 ${id}`, exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: `任务 ${otherId}`, exact: true })).toContainText('海边双拼');
  await page.getByRole('combobox', { name: '演示身份' }).selectOption('demo-bob');
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveValue('demo-bob');
  await expect(page.getByRole('article', { name: `任务 ${id}`, exact: true })).toHaveCount(0);
});

test('real background tasks progress independently to success and a specified failure', async ({ page }) => {
  let writes = 0;
  await page.route('**/api/tasks', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    writes += 1;
    const response = await route.fetch({ postData: {
      ...route.request().postDataJSON(),
      simulation: { stepDelayMs: 2000, failAtStage: writes === 2 ? 'MOCK_GENERATION' : null },
    } });
    await route.fulfill({ response });
  });
  await openCreation(page);
  await readyImage(page);
  const ids: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    await page.getByRole('button', { name: index === 0 ? '开始制作' : '再次制作', exact: true }).click();
    const label = page.getByRole('region', { name: '提交回执' }).getByLabel('任务 ID');
    if (ids.length) await expect(label).not.toHaveText(ids[ids.length - 1]);
    ids.push(await label.innerText());
  }
  for (const id of ids.slice(0, 2)) {
    await expect(page.getByRole('article', { name: `任务 ${id}`, exact: true })).toContainText('处理中');
  }
  await expect(page.getByRole('article', { name: `任务 ${ids[2]}`, exact: true })).toContainText('等待处理');
  const failed = page.getByRole('article', { name: `任务 ${ids[1]}`, exact: true });
  await expect(failed).toContainText('制作失败');
  await expect(failed).toContainText('模拟生成');
  for (const id of [ids[0], ids[2]]) {
    const card = page.getByRole('article', { name: `任务 ${id}`, exact: true });
    await expect(card).toContainText('制作成功');
    await expect(card.getByRole('img', { name: '山野明信片制作结果' })).toBeVisible();
  }
});
