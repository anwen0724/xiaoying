import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chooseIdentity } from '../tests/helpers';

test('clean production build completes the real user journey and persists its outcomes', async ({ page }) => {
  const evidenceDirectory = '../artifacts/phase-7';
  await mkdir(evidenceDirectory, { recursive: true });
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('link', { name: /山野明信片/ })).toBeVisible();
  await page.getByRole('link', { name: '创意设计', exact: true }).click();
  await expect(page.getByRole('link', { name: /山野明信片/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /三格灵感板/ })).toBeVisible();
  await page.getByRole('link', { name: '全部模板', exact: true }).click();
  await page.screenshot({ path: `${evidenceDirectory}/catalog.png`, fullPage: true });
  await chooseIdentity(page, 'demo-alice');
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveText('小禾');
  const initial = await page.request.get('/api/tasks');
  expect(initial.ok()).toBe(true);
  expect((await initial.json()).items).toEqual([]);

  const submitted: string[] = [];
  let singleAssetIds: string[] = [];
  const templates = [
    { id: 'mountain-card', count: 1, width: 1440 },
    { id: 'travel-duo', count: 2, width: 390 },
    { id: 'inspiration-grid', count: 3, width: 390 },
  ];
  for (const template of templates) {
    await page.setViewportSize({ width: template.width, height: 900 });
    await page.goto(`/templates/${template.id}`);
    await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveText('小禾');
    await page.getByLabel('图片 1', { exact: true }).setInputFiles(
      Array.from({ length: template.count }, () => path.resolve('../assets/demo/inputs/mountain.png')),
    );
    await expect(page.getByText('上传成功', { exact: true })).toHaveCount(template.count);
    await page.getByRole('button', { name: '放大查看图片 1 预览', exact: true }).click();
    const uploadPreview = page.getByRole('dialog', { name: '图片 1 预览', exact: true });
    await expect(uploadPreview).toBeVisible();
    await expect.poll(() => uploadPreview.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(uploadPreview).not.toBeVisible();
    const submission = page.waitForRequest((request) =>
      new URL(request.url()).pathname === '/api/tasks' && request.method() === 'POST');
    await page.getByRole('button', { name: '开始制作', exact: true }).focus();
    await page.keyboard.press('Enter');
    if (template.count === 1) singleAssetIds = (await submission).postDataJSON().assetIds;
    else await submission;
    const receipt = page.getByRole('region', { name: '提交回执' });
    await expect(receipt).toBeVisible();
    const id = await receipt.getByLabel('任务 ID').innerText();
    submitted.push(id);
    await page.reload();
    const card = page.getByRole('article', { name: `任务 ${id}`, exact: true });
    await expect(card).toContainText('制作成功');
    await expect(card.getByRole('img')).toBeVisible();
    await card.getByRole('button', { name: /^放大查看/ }).click();
    const resultPreview = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: '关闭预览' }) });
    await expect(resultPreview).toBeVisible();
    await expect.poll(() => resultPreview.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await resultPreview.getByRole('button', { name: '关闭预览' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${evidenceDirectory}/${template.id}.png`, fullPage: true });
  }

  async function createTask(stepDelayMs: number, failAtStage: string | null) {
    const response = await page.request.post('/api/tasks', { data: {
      templateId: 'mountain-card', assetIds: singleAssetIds, simulation: { stepDelayMs, failAtStage },
    } });
    expect(response.status()).toBe(202);
    return (await response.json()).id as string;
  }

  // The public simulation API configures real Java jobs; no HTTP response is replaced.
  const mixed = [await createTask(2000, null), await createTask(2000, 'MOCK_GENERATION'), await createTask(2000, null)];
  const states = await page.request.get(`/api/tasks/status?ids=${mixed.join(',')}`);
  expect((await states.json()).items.map((task: { status: string }) => task.status))
    .toEqual(['RUNNING', 'RUNNING', 'QUEUED']);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/templates/mountain-card');
  await expect(page.getByRole('article', { name: `任务 ${mixed[2]}`, exact: true })).toContainText('等待处理');
  await page.reload();
  for (const [index, id] of mixed.entries()) {
    const card = page.getByRole('article', { name: `任务 ${id}`, exact: true });
    await expect(card).toContainText(index === 1 ? '制作失败' : '制作成功');
    if (index !== 1) await expect(card.getByRole('img')).toBeVisible();
  }

  const stages = ['MATERIAL_CHECK', 'MOCK_GENERATION', 'RESULT_FINALIZATION'];
  const failures: string[] = [];
  for (const [position, stage] of stages.entries()) {
    const id = await createTask(0, stage);
    failures.push(id);
    await expect.poll(async () => (await (await page.request.get(`/api/tasks/${id}`)).json()).status).toBe('FAILED');
    const detail = await (await page.request.get(`/api/tasks/${id}`)).json();
    expect(detail.failure.stage).toBe(stage);
    expect(detail.steps.map((step: { status: string }) => step.status)).toEqual(
      stages.map((_, index) => index < position ? 'SUCCEEDED' : index === position ? 'FAILED' : 'SKIPPED'),
    );
  }

  await page.getByRole('link', { name: '我的素材', exact: true }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole('heading', { name: '我的素材', exact: true })).toBeVisible();
  const ids = [...submitted, ...mixed, ...failures];
  for (const id of ids) await expect(page.getByRole('article', { name: `任务 ${id}`, exact: true })).toBeVisible();
  await page.screenshot({ path: `${evidenceDirectory}/history.png`, fullPage: true });
  await page.getByRole('link', { name: '创意设计', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article', { name: `任务 ${submitted[2]}`, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('link', { name: '全部', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(ids.length);
  await page.getByRole('button', { name: '刷新记录', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(ids.length);
  expect((await (await page.request.get('/api/tasks')).json()).items.map((task: { id: string }) => task.id).sort())
    .toEqual([...ids].sort());

  const snapshots = [];
  for (const id of ids) {
    const response = await page.request.get(`/api/tasks/${id}`);
    expect(response.ok()).toBe(true);
    snapshots.push(await response.json());
  }
  await chooseIdentity(page, 'demo-bob');
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveText('阿远');
  await expect(page.getByText(/还没有制作记录/)).toBeVisible();
  expect((await page.request.get(`/api/tasks/${ids[0]}`)).status()).toBe(404);
  await expect(page.getByRole('article')).toHaveCount(0);
  await chooseIdentity(page, 'demo-alice');
  await expect(page.getByRole('article')).toHaveCount(ids.length);
  await page.getByRole('button', { name: '退出身份', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
  await writeFile(`${evidenceDirectory}/production-acceptance.json`, JSON.stringify({ snapshots, runtimeErrors }, null, 2));
});
