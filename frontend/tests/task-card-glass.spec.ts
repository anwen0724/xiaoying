import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { taskFixture, failedTask } from './fixtures/tasks';

for (const path of ['/history', '/templates/mountain-card']) {
  test(`record card hover preserves geometry and preview at ${path}`, async ({ page }) => {
    const tasks = [taskFixture(801, { status: 'SUCCEEDED', stage: 'RESULT_FINALIZATION',
      resultUrl: '/demo/results/mountain-card.svg' }), failedTask(802)];
    await page.route('**/api/session', (route) => route.fulfill({ json: { id: 'demo-alice', displayName: '小禾' } }));
    await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill({ json: { items: tasks, nextCursor: null } }));
    await page.route('**/api/tasks/active*', (route) => route.fulfill({ json: { items: [] } }));
    await page.goto(path);
    const card = page.getByRole('article', { name: `任务 ${tasks[0].id}`, exact: true });
    const sibling = page.getByRole('article', { name: `任务 ${tasks[1].id}`, exact: true });
    const preview = card.getByRole('button', { name: '放大查看山野明信片制作结果', exact: true });
    await expect(preview).toBeVisible();
    const before = (await card.boundingBox())!;
    const siblingBefore = await sibling.boundingBox();
    await card.hover();
    await expect(card).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -2)');
    await expect(preview.getByRole('img')).toHaveCSS('transform', 'matrix(1.02, 0, 0, 1.02, 0, 0)');
    const after = (await card.boundingBox())!;
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height);
    if (path.startsWith('/templates/')) {
      const list = page.getByRole('region', { name: '本模板记录列表', exact: true });
      expect(after.y).toBeGreaterThanOrEqual((await list.boundingBox())!.y);
    }
    expect(await sibling.boundingBox()).toEqual(siblingBefore);
    await mkdir('../artifacts/task-card-glass', { recursive: true });
    await page.screenshot({ path: `../artifacts/task-card-glass/${path === '/history' ? 'history' : 'detail'}-hover.png`, animations: 'disabled' });
    await preview.click();
    const dialog = page.getByRole('dialog', { name: '山野明信片制作结果', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('img')).toHaveCSS('transform', 'none');
    await page.keyboard.press('Escape');
    await expect(preview).toBeFocused();
    await page.mouse.move(0, 0);
    await expect(card).toHaveCSS('transform', 'none');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await card.hover();
    await expect(card).toHaveCSS('transform', 'none');
    await expect(preview.getByRole('img')).toHaveCSS('transform', 'none');
    await page.setViewportSize({ width: 390, height: 844 });
    await card.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ path: `../artifacts/task-card-glass/${path === '/history' ? 'history' : 'detail'}-mobile.png`, animations: 'disabled' });
  });
}
