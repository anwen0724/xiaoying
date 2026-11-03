import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { failedTask } from './fixtures/tasks';
import { gate } from './helpers';

for (const [routePath, width] of [['/templates/mountain-card', 390], ['/history', 1440]] as const) {
  test(`scroll loads older records without a button on ${routePath}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/session', (route) => route.fulfill({ json: { id: 'demo-alice', displayName: '小禾' } }));
    await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [] } }));
    const release = gate();
    let pageReads = 0;
    await page.route((url) => url.pathname === '/api/tasks', async (route) => {
      if (!new URL(route.request().url()).searchParams.has('cursor')) {
        return route.fulfill({ json: { items: Array.from({ length: 20 }, (_, i) => failedTask(100 - i)), nextCursor: 'older' } });
      }
      pageReads += 1;
      await release.promise;
      await route.fulfill({ json: { items: [failedTask(81), failedTask(80)], nextCursor: null } });
    });
    await page.goto(routePath);
    await expect(page.getByRole('article')).toHaveCount(20);
    await expect(page.getByRole('button', { name: '加载更多', exact: true })).toHaveCount(0);
    expect(pageReads).toBe(0);
    async function scrollToEnd() {
      if (routePath === '/history') await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      else {
        const list = page.getByRole('region', { name: '本模板记录列表', exact: true });
        await list.scrollIntoViewIfNeeded();
        await list.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      }
    }
    await scrollToEnd();
    await expect(page.getByText('正在加载更多记录…', { exact: true })).toBeVisible();
    await scrollToEnd();
    expect(pageReads).toBe(1);
    release.release();
    await expect(page.getByRole('article')).toHaveCount(21);
    await scrollToEnd();
    await expect(page.getByRole('article', { name: `任务 ${failedTask(80).id}`, exact: true })).toBeVisible();
    expect(pageReads).toBe(1);
    await mkdir('../artifacts/history-scroll', { recursive: true });
    await page.screenshot({ path: `../artifacts/history-scroll/end-${width}.png` });
  });
}
