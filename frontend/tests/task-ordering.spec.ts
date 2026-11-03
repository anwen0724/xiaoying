import { expect, test } from '@playwright/test';
import { finishResponseAndRender, gate, ignoreTransportCancellation, openCreation, readyImage } from './helpers';
import { failedTask, taskFixture } from './fixtures/tasks';

test('late history and higher-version invalid transitions cannot undo a terminal task', async ({ page }) => {
  const task = taskFixture(11);
  const release = gate();
  await ignoreTransportCancellation(page);
  let refreshing = false;
  await page.route((url) => url.pathname === '/api/tasks', async (route) => {
    const initial = !refreshing;
    if (initial) await release.promise;
    await route.fulfill({ json: { items: [initial ? task : taskFixture(11, { version: 10, status: 'RUNNING', stage: 'MATERIAL_CHECK' })], nextCursor: null } });
  });
  await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [task] } }));
  await page.route('**/api/tasks/status?*', (route) => route.fulfill({ json: { items: [failedTask(11)], missingIds: [] } }));
  await openCreation(page);
  const card = page.getByRole('article', { name: `任务 ${task.id}`, exact: true });
  await expect(card).toContainText('制作失败');
  const response = page.waitForResponse((result) => new URL(result.url()).pathname === '/api/tasks');
  release.release();
  await finishResponseAndRender(page, await response);
  await expect(card).toContainText('制作失败');
  refreshing = true;
  await page.getByRole('button', { name: '刷新记录', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '任务数据前后不一致' })).toBeVisible();
  await expect(card).toContainText('制作失败');
});

test('refresh discards a late page response and can recover a page read failure', async ({ page }) => {
  await ignoreTransportCancellation(page);
  const started = gate();
  const release = gate();
  let refreshing = false;
  let pageReads = 0;
  await page.route((url) => url.pathname === '/api/tasks', async (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    if (cursor) {
      pageReads += 1;
      expect(cursor).toBe('page-two');
      if (pageReads === 1) return route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: '这一页暂时无法读取' } });
      started.release();
      await release.promise;
      return route.fulfill({ json: { items: [failedTask(22)], nextCursor: null } });
    }
    await route.fulfill({ json: { items: [failedTask(refreshing ? 23 : 21)], nextCursor: refreshing ? null : 'page-two' } });
  });
  await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [] } }));
  await openCreation(page);
  await expect(page.getByRole('alert').filter({ hasText: '这一页暂时无法读取' })).toBeVisible();
  await expect(page.getByRole('article', { name: `任务 ${failedTask(21).id}`, exact: true })).toBeVisible();
  expect(pageReads).toBe(1);
  await page.getByRole('button', { name: '重新加载记录', exact: true }).click();
  await started.promise;
  refreshing = true;
  await page.getByRole('button', { name: '刷新记录', exact: true }).click();
  await expect(page.getByRole('article', { name: `任务 ${failedTask(23).id}`, exact: true })).toBeVisible();
  const response = page.waitForResponse((result) => new URL(result.url()).searchParams.has('cursor'));
  release.release();
  await finishResponseAndRender(page, await response);
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article', { name: `任务 ${failedTask(22).id}`, exact: true })).toHaveCount(0);
});

test('a newly accepted task survives an older initial history response', async ({ page }) => {
  const release = gate();
  await page.route((url) => url.pathname === '/api/tasks', async (route) => {
    if (route.request().method() === 'POST') return route.continue();
    await release.promise;
    await route.fulfill({ json: { items: [], nextCursor: null } });
  });
  await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [] } }));
  await openCreation(page);
  await readyImage(page);
  await page.getByRole('button', { name: '开始制作', exact: true }).click();
  const id = await page.getByRole('region', { name: '提交回执' }).getByLabel('任务 ID').innerText();
  const response = page.waitForResponse((result) => new URL(result.url()).pathname === '/api/tasks' && result.request().method() === 'GET');
  release.release();
  await finishResponseAndRender(page, await response);
  await expect(page.getByRole('article', { name: `任务 ${id}`, exact: true })).toBeVisible();
});

test('loading more appends unique records and an invalid cursor requires a fresh page', async ({ page }) => {
  let refreshed = false;
  await page.route((url) => url.pathname === '/api/tasks', (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    if (cursor === 'expired-page') {
      return route.fulfill({ status: 400, json: { code: 'INVALID_CURSOR', message: '分页位置已失效，请刷新记录' } });
    }
    return route.fulfill({ json: cursor === 'page-two'
      ? { items: [failedTask(31), failedTask(32)], nextCursor: 'expired-page' }
      : { items: [failedTask(31)], nextCursor: refreshed ? null : 'page-two' },
    });
  });
  await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [] } }));
  await openCreation(page);
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('region', { name: '本模板记录', exact: true }).getByRole('alert')).toContainText('分页位置已失效');
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '加载更多', exact: true })).toHaveCount(0);
  refreshed = true;
  await page.getByRole('button', { name: '刷新记录', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('region', { name: '本模板记录', exact: true }).getByRole('alert')).toHaveCount(0);
});
