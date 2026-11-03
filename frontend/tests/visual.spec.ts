import { test, expect } from '@playwright/test';
import { chooseIdentity, readyImage } from './helpers';
import { failedTask, taskFixture } from './fixtures/tasks';
import type { Task } from '../src/features/tasks/types';

for (const width of [1440, 768, 390]) {
  test(`usable catalog, creation and history at ${width}px`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) runtimeErrors.push(message.text());
    });
    let accepted: Task | null = null;
    const historical = [
      taskFixture(401, { status: 'SUCCEEDED', version: 6, stage: 'RESULT_FINALIZATION',
        finishedAt: '2026-11-02T06:00:03.000Z', resultUrl: '/demo/results/mountain-card.svg' }),
      failedTask(402),
    ];
    // Keep visual evidence compact and repeatable; the submitted task still runs in Java.
    await page.route((url) => url.pathname === '/api/tasks', async (route) => {
      if (route.request().method() === 'POST') {
        const response = await route.fetch();
        accepted = await response.json();
        return route.fulfill({ response });
      }
      return route.fulfill({ json: { items: [...historical, ...(accepted ? [accepted] : [])], nextCursor: null } });
    });
    await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [] } }));
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 900 });
    await page.goto('/');
    await expect(page.getByRole('link', { name: /山野明信片/ })).toBeVisible();
    await expect(page.getByRole('combobox', { name: '演示身份' })).toBeEnabled();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `../artifacts/phase-5/live/catalog-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: /山野明信片/ }).click();
    await chooseIdentity(page, 'demo-alice');
    await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveText('小禾');
    await readyImage(page);
    const submit = page.getByRole('button', { name: '开始制作', exact: true });
    await submit.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: '提交回执' })).toBeVisible();
    const id = await page.getByRole('region', { name: '提交回执' }).getByLabel('任务 ID').innerText();
    await expect(page.getByRole('article', { name: `任务 ${id}`, exact: true }).getByRole('img')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `../artifacts/phase-5/live/creation-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('link', { name: '我的素材', exact: true }).click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(page.getByRole('heading', { level: 1, name: '我的素材', exact: true })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(3);
    await expect(page.getByRole('article', { name: `任务 ${id}`, exact: true }).getByRole('img')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `../artifacts/phase-5/live/history-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(runtimeErrors).toEqual([]);
  });
}
