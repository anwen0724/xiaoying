import { expect, test } from '@playwright/test';
import { finishResponseAndRender, gate, ignoreTransportCancellation, openCreation } from './helpers';
import { failedTask, taskFixture } from './fixtures/tasks';

for (const change of ['identity', 'template'] as const) {
  test(`late status cannot enter another ${change} scope; leaving stops polling`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-02T08:00:00Z') });
    await ignoreTransportCancellation(page);
    const task = taskFixture(51);
    const started = gate();
    const release = gate();
    let originalScope = true;
    let polls = 0;
    await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill({
      json: { items: originalScope ? [task] : [], nextCursor: null },
    }));
    await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: originalScope ? [task] : [] } }));
    await page.route('**/api/tasks/status?*', async (route) => {
      polls += 1;
      started.release();
      await release.promise;
      await route.fulfill({ json: { items: [failedTask(51)], missingIds: [] } });
    });
    await openCreation(page);
    await started.promise;
    await expect(page.getByRole('article', { name: `任务 ${task.id}`, exact: true })).toBeVisible();
    originalScope = false;
    if (change === 'identity') {
      await page.getByRole('combobox', { name: '演示身份' }).selectOption('demo-bob');
      await expect(page.getByText('当前身份：阿远', { exact: true })).toBeVisible();
    } else {
      await page.getByRole('link', { name: '模板库', exact: true }).click();
      await page.getByRole('link', { name: /海边双拼/ }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('海边双拼');
    }
    const response = page.waitForResponse('**/api/tasks/status?*');
    release.release();
    await finishResponseAndRender(page, await response);
    await expect(page.getByRole('article')).toHaveCount(0);
    await page.getByRole('link', { name: '模板库', exact: true }).click();
    await expect(page.getByRole('link', { name: /山野明信片/ })).toBeVisible();
    await page.clock.pauseAt(new Date('2026-11-02T09:00:00Z'));
    await page.clock.runFor(10_000);
    expect(polls).toBe(1);
  });
}

test('slow polling never overlaps; hidden pages pause and recheck identity before resuming', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T08:00:00Z') });
  const task = taskFixture(52);
  const started = gate();
  const release = gate();
  let polls = 0;
  let identityReads = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/session' && request.method() === 'GET') identityReads += 1;
  });
  await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill({ json: { items: [task], nextCursor: null } }));
  await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [task] } }));
  await page.route('**/api/tasks/status?*', async (route) => {
    polls += 1;
    if (polls === 1) {
      started.release();
      await release.promise;
    }
    await route.fulfill({ json: { items: [polls === 1 ? task : failedTask(52)], missingIds: [] } });
  });
  await openCreation(page);
  await started.promise;
  await page.clock.pauseAt(new Date('2026-11-02T09:00:00Z'));
  await page.clock.runFor(10_000);
  expect(polls).toBe(1);
  // Visibility is a browser boundary, not application state.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const first = page.waitForResponse('**/api/tasks/status?*');
  release.release();
  await (await first).finished();
  await page.clock.runFor(10_000);
  expect(polls).toBe(1);
  const previousIdentityReads = identityReads;
  const identity = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/session');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await (await identity).finished();
  const resumed = page.waitForResponse('**/api/tasks/status?*');
  await page.clock.runFor(10);
  await (await resumed).finished();
  await page.clock.runFor(10);
  await expect(page.getByRole('article')).toContainText('制作失败');
  expect(identityReads).toBeGreaterThan(previousIdentityReads);
  expect(polls).toBe(2);
});

test('active read failure leaves known tasks usable and retry discovers the remaining tasks', async ({ page }) => {
  let unavailable = true;
  await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill({ json: { items: [taskFixture(53)], nextCursor: null } }));
  await page.route('**/api/tasks/active', (route) => unavailable
    ? route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: '恢复接口暂时不可用' } })
    : route.fulfill({ json: { items: [taskFixture(54)] } }));
  await page.route('**/api/tasks/status?*', (route) => {
    const ids = new URL(route.request().url()).searchParams.get('ids')?.split(',') ?? [];
    return route.fulfill({ json: { items: ids.map((id) => failedTask(Number(id.slice(-12)))), missingIds: [] } });
  });
  await openCreation(page);
  await expect(page.getByRole('region', { name: '本模板记录', exact: true }).getByRole('alert')).toContainText('未完成任务恢复不完整');
  await expect(page.getByRole('article')).toContainText('制作失败');
  unavailable = false;
  await page.getByRole('button', { name: '重试恢复未完成任务', exact: true }).click();
  await expect(page.getByRole('article').filter({ hasText: '制作失败' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: '重试恢复未完成任务', exact: true })).toHaveCount(0);
});

test('status 401 clears task data and requires choosing identity again', async ({ page }) => {
  await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill({ json: { items: [taskFixture(55)], nextCursor: null } }));
  await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [taskFixture(55)] } }));
  await page.route('**/api/tasks/status?*', (route) => route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED', message: '会话失效' } }));
  await page.goto('/templates/mountain-card');
  await page.getByRole('combobox', { name: '演示身份' }).selectOption('demo-alice');
  await expect(page.getByText('会话已失效，请重新选择身份。', { exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveValue('');
});
