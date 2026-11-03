import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { readyImage } from './helpers';
import { failedTask, taskFixture } from './fixtures/tasks';

// Fixed content and time let the three review runs compare only the named UI changes.
for (const width of [1440, 768, 390]) {
  test(`fixed review scenes at ${width}px`, async ({ page }) => {
    const directory = `../artifacts/phase-5/${process.env.UI_REVIEW_VERSION ?? 'final'}`;
    await mkdir(directory, { recursive: true });
    const items = [
      taskFixture(504, { status: 'SUCCEEDED', stage: 'RESULT_FINALIZATION', version: 6,
        finishedAt: '2026-11-02T06:00:03.000Z', resultUrl: '/demo/results/mountain-card.svg' }),
      failedTask(503),
      taskFixture(502, { status: 'RUNNING', stage: 'MOCK_GENERATION', version: 2 }),
      taskFixture(501),
    ];
    let scene: 'mixed' | 'empty' | 'error' = 'mixed';
    await page.clock.setFixedTime(new Date('2026-11-02T08:00:00.000Z'));
    await page.setViewportSize({ width, height: 900 });
    await page.route((url) => url.pathname === '/api/tasks', (route) => scene === 'error'
      ? route.fulfill({ status: 503, json: { message: '记录服务暂时不可用', code: 'READ_ERROR' } })
      : route.fulfill({ json: { items: scene === 'empty' ? [] : items, nextCursor: null } }));
    await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [] } }));
    await page.route('**/api/tasks/status*', (route) => route.fulfill({ json: { items: items.slice(2), missingIds: [] } }));

    async function capture(name: string) {
      await page.evaluate(async () => {
        window.scrollTo(0, 0);
        await document.fonts.ready;
        const images = [...document.images].filter((img) => img.checkVisibility());
        // Full-page captures include offscreen lazy images, but not hidden route copies.
        images.forEach((img) => { img.loading = 'eager'; });
        await Promise.all(images.map((img) => img.decode()));
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `${directory}/${name}-${width}.png`, fullPage: true, animations: 'disabled' });
    }

    await page.goto('/');
    await expect(page.getByRole('link', { name: /山野明信片/ })).toBeVisible();
    await expect(page.getByRole('combobox', { name: '演示身份' })).toBeEnabled();
    await capture('catalog');
    await page.getByRole('link', { name: /山野明信片/ }).click();
    await page.getByRole('combobox', { name: '演示身份' }).selectOption('demo-alice');
    await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveValue('demo-alice');
    await readyImage(page);
    await expect(page.getByRole('article')).toHaveCount(4);
    await expect(page.getByRole('img', { name: '山野明信片制作结果', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '刷新记录', exact: true })).toBeEnabled();
    const firstCard = page.getByRole('article').first();
    await expect(firstCard.getByText('任务详情', { exact: true })).toHaveCount(0);
    await expect(firstCard.getByRole('button', { name: '放大查看山野明信片制作结果', exact: true })).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.locator('main').evaluate((element) =>
      [...element.querySelectorAll('*')].every((child) => getComputedStyle(child).animationName === 'none'),
    )).toBe(true);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await capture('creation');
    const metrics = await page.evaluate(() => {
      const bounds = (selector: string) => {
        const element = document.querySelector(selector)!;
        const rect = element.getBoundingClientRect();
        return { x: rect.x, width: rect.width, columns: getComputedStyle(element).gridTemplateColumns };
      };
      const submit = [...document.querySelectorAll('button')].find((button) => button.textContent === '开始制作')!;
      return { canvas: bounds('.canvas'), layout: bounds('.creation-layout'), input: bounds('.creation-input'),
        history: bounds('section[aria-label="本模板记录"]'), submitBottom: submit.getBoundingClientRect().bottom + scrollY };
    });
    await writeFile(`${directory}/metrics-${width}.json`, JSON.stringify(metrics, null, 2));
    if (width === 1440) expect(metrics.submitBottom).toBeLessThanOrEqual(900);

    await page.getByRole('link', { name: '我的素材', exact: true }).click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(page.getByRole('heading', { level: 1, name: '我的制作记录' })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(4);
    await expect(page.getByRole('img', { name: '山野明信片制作结果', exact: true })).toBeVisible();
    await capture('history');

    // A fresh navigation removes locally retained task snapshots for the empty/error scenes.
    scene = 'empty';
    await page.reload();
    await expect(page.getByText('还没有制作记录，', { exact: false })).toBeVisible();
    await capture('empty');
    scene = 'error';
    await page.getByRole('button', { name: '刷新记录', exact: true }).click();
    await expect(page.getByRole('button', { name: '重新加载记录', exact: true })).toBeVisible();
    await capture('error');
  });
}
