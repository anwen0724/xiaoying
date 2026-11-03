import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { failedTask, taskFixture } from './fixtures/tasks';
import { chooseIdentity, finishResponseAndRender, gate, ignoreTransportCancellation } from './helpers';

const design = Array.from({ length: 23 }, (_, i) => failedTask(1100 + i, {
  templateId: 'minimal-cover', templateTitle: '极简封面',
}));
const travel = failedTask(1200);

for (const width of [1440, 390]) {
  test(`material category navigation, pagination and refresh at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/session', (route) => route.fulfill({ json: { id: 'demo-alice', displayName: '小禾' } }));
    const activeCategories: (string | null)[] = [];
    await page.route('**/api/tasks/active*', (route) => {
      activeCategories.push(new URL(route.request().url()).searchParams.get('category'));
      return route.fulfill({ json: { items: [] } });
    });
    const reads: string[] = [];
    await page.route((url) => url.pathname === '/api/tasks', (route) => {
      const query = new URL(route.request().url()).searchParams;
      reads.push(query.toString());
      const items = query.get('category') === 'design' ? design : query.get('category') === 'travel' ? [travel] : [design[0], travel];
      const more = query.has('cursor');
      return route.fulfill({ json: { items: more ? items.slice(20) : items.slice(0, 20), nextCursor: !more && items.length > 20 ? 'design-page-2' : null } });
    });
    await page.goto('/history');
    await expect(page.getByRole('heading', { level: 1, name: '我的素材', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '我的记录', exact: true })).toHaveCount(0);
    const filters = page.getByRole('navigation', { name: '素材分类' });
    await expect(filters.getByRole('link', { name: '全部', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('article')).toHaveCount(2);
    await filters.getByRole('link', { name: '创意设计' }).click();
    await expect(page).toHaveURL(/\/history\?category=design$/);
    await expect(page.getByRole('article')).toHaveCount(20);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByRole('article')).toHaveCount(23);
    expect(reads.some((query) => query.includes('category=design') && query.includes('cursor=design-page-2'))).toBe(true);
    expect(activeCategories).toContain('design');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: '刷新记录', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(20);
    await filters.getByRole('link', { name: '旅行记忆' }).click();
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('article')).toContainText('山野明信片');
    await page.reload();
    await expect(filters.getByRole('link', { name: '旅行记忆' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('article')).toHaveCount(1);
    expect(activeCategories).toContain('travel');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await mkdir('../artifacts/material-categories', { recursive: true });
    await page.screenshot({ path: `../artifacts/material-categories/${width}.png`, fullPage: true });
    await filters.getByRole('link', { name: '全部', exact: true }).click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(page.getByRole('article')).toHaveCount(2);
  });
}

test('category changes reject late history and active results; recovery and identity changes keep their scope', async ({ page }) => {
  await ignoreTransportCancellation(page);
  let user = 'demo-alice';
  await page.route('**/api/session', (route) => {
    if (route.request().method() === 'POST') user = route.request().postDataJSON().userId;
    return route.fulfill({ json: { id: user, displayName: user === 'demo-alice' ? '小禾' : '阿远' } });
  });
  const release = gate();
  const historyStarted = gate();
  const activeStarted = gate();
  let unavailable = false;
  await page.route((url) => url.pathname === '/api/tasks', async (route) => {
    if (new URL(route.request().url()).searchParams.get('category') === 'design') {
      historyStarted.release();
      await release.promise;
      return route.fulfill({ json: { items: [design[0]], nextCursor: null } });
    }
    return route.fulfill(unavailable
      ? { status: 503, json: { message: '分类记录暂时无法读取', code: 'UNAVAILABLE' } }
      : { json: { items: user === 'demo-alice' ? [travel] : [], nextCursor: null } });
  });
  await page.route('**/api/tasks/active*', async (route) => {
    if (new URL(route.request().url()).searchParams.get('category') === 'design') {
      activeStarted.release();
      await release.promise;
      return route.fulfill({ json: { items: [taskFixture(1300, { templateId: 'minimal-cover' })] } });
    }
    return route.fulfill({ json: { items: [] } });
  });
  await page.goto('/history?category=design');
  await Promise.all([historyStarted.promise, activeStarted.promise]);
  await page.getByRole('link', { name: '旅行记忆', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  const late = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/tasks'
    && new URL(response.url()).searchParams.get('category') === 'design');
  release.release();
  await finishResponseAndRender(page, await late);
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('山野明信片');
  unavailable = true;
  await page.getByRole('button', { name: '刷新记录', exact: true }).click();
  const retry = page.getByRole('button', { name: '重新加载记录', exact: true });
  await expect(retry).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(1);
  unavailable = false;
  await retry.click();
  await expect(retry).toHaveCount(0);
  await expect(page.getByRole('region', { name: '我的素材', exact: true })).toBeFocused();
  await chooseIdentity(page, 'demo-bob');
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByText('这个分类还没有制作记录。', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '旅行记忆', exact: true })).toHaveAttribute('aria-current', 'page');
});
