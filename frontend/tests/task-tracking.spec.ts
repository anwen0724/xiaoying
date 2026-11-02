import { expect, test } from '@playwright/test';
import { openCreation } from './helpers';
import { failedTask, taskFixture } from './fixtures/tasks';

test('query failure preserves task state, pauses polling, and resumes explicitly', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T08:00:00Z') });
  const task = taskFixture(1, { status: 'RUNNING', stage: 'MOCK_GENERATION', version: 2 });
  await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill({ json: { items: [task], nextCursor: null } }));
  await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [task] } }));
  let polls = 0;
  await page.route('**/api/tasks/status?*', (route) => {
    polls += 1;
    return polls === 1 ? route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: '查询服务暂时不可用' } })
      : route.fulfill({ json: { items: [failedTask(1)], missingIds: [] } });
  });
  await openCreation(page);
  const card = page.getByRole('article', { name: `任务 ${task.id}`, exact: true });
  await expect(page.getByRole('button', { name: '恢复查询', exact: true })).toBeVisible();
  await expect(card).toContainText('处理中');
  await expect(card).not.toContainText('制作失败');
  await page.clock.pauseAt(new Date('2026-11-02T09:00:00Z'));
  await page.clock.runFor(10_000);
  expect(polls).toBe(1);
  const recovered = page.waitForResponse('**/api/tasks/status?*');
  await page.getByRole('button', { name: '恢复查询', exact: true }).click();
  await page.clock.runFor(1);
  await (await recovered).finished();
  await page.clock.runFor(10);
  await expect(card).toContainText('制作失败');
  await expect(card).toContainText('演示生成失败');
  await page.clock.runFor(10_000);
  expect(polls).toBe(2);
});

test('active restores tasks outside the first history page and batches at most 100 IDs', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T08:00:00Z') });
  const active = Array.from({ length: 101 }, (_, index) => taskFixture(index + 1));
  await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill({ json: { items: [], nextCursor: null } }));
  await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: active } }));
  const batches: string[][] = [];
  await page.route('**/api/tasks/status?*', (route) => {
    const ids = new URL(route.request().url()).searchParams.get('ids')?.split(',') ?? [];
    batches.push(ids);
    return route.fulfill({ json: { items: ids.map((id) => failedTask(Number(id.slice(-12)))), missingIds: [] } });
  });
  await openCreation(page);
  await expect(page.getByRole('article')).toHaveCount(101);
  await expect(page.getByRole('article').filter({ hasText: '制作失败' })).toHaveCount(101);
  expect(batches.map((batch) => batch.length)).toEqual([100, 1]);
  expect(new Set(batches.flat()).size).toBe(101);
  await page.clock.pauseAt(new Date('2026-11-02T09:00:00Z'));
  await page.clock.runFor(10_000);
  expect(batches).toHaveLength(2);
});

test('missing records stop tracking without becoming execution failures', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T08:00:00Z') });
  const task = taskFixture(2);
  await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill({ json: { items: [task], nextCursor: null } }));
  await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [task] } }));
  let polls = 0;
  await page.route('**/api/tasks/status?*', (route) => {
    polls += 1;
    return route.fulfill({ json: { items: [], missingIds: [task.id] } });
  });
  await openCreation(page);
  await expect(page.getByText(`记录不可访问：${task.id}`, { exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByText('制作失败', { exact: true })).toHaveCount(0);
  await page.clock.pauseAt(new Date('2026-11-02T09:00:00Z'));
  await page.clock.runFor(10_000);
  expect(polls).toBe(1);
});

test('image read failure does not change a successful task and can retry', async ({ page }) => {
  const task = taskFixture(3, { status: 'SUCCEEDED', version: 6, stage: 'RESULT_FINALIZATION',
    finishedAt: '2026-11-02T06:00:03.000Z', resultUrl: '/demo/results/mountain-card.svg' });
  await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill({ json: { items: [task], nextCursor: null } }));
  await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [] } }));
  let unavailable = true;
  await page.route('**/demo/results/mountain-card.svg', (route) => unavailable ? route.fulfill({ status: 500, body: 'unavailable' }) : route.continue());
  await openCreation(page);
  const card = page.getByRole('article', { name: `任务 ${task.id}`, exact: true });
  await expect(card.getByRole('alert')).toContainText('任务仍已成功');
  await expect(card).toContainText('制作成功');
  unavailable = false;
  await card.getByRole('button', { name: '重新加载图片', exact: true }).click();
  await expect(card.getByRole('img', { name: '山野明信片制作结果' })).toBeVisible();
});
