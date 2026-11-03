import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { failedTask } from './fixtures/tasks';

for (const [width, height, template] of [
  [1440, 900, 'mountain-card'],
  [1440, 768, 'inspiration-grid'],
  [390, 844, 'inspiration-grid'],
] as const) {
  test(`detail scroll boundaries at ${width}x${height} for ${template}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.route('**/api/session', (route) => route.fulfill({ json: { id: 'demo-alice', displayName: '小禾' } }));
    await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [] } }));
    await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill({
      json: { items: Array.from({ length: 20 }, (_, i) => ({ ...failedTask(900 + i), templateId: template })), nextCursor: null },
    }));
    await page.goto(`/templates/${template}`);
    await expect(page.getByRole('article')).toHaveCount(20);
    const left = page.locator('#main-content .creation-input');
    const content = left.getByRole('region', { name: '模板与上传内容', exact: true });
    const list = page.getByRole('region', { name: '本模板记录列表', exact: true });
    const refresh = page.getByRole('button', { name: '刷新记录', exact: true });
    const refreshBounds = (await refresh.boundingBox())!;
    expect((await list.boundingBox())!.y - refreshBounds.y - refreshBounds.height).toBe(16);
    if (width > 1000) {
      await expect(content).toHaveCSS('scrollbar-width', 'none');
      await expect(list).toHaveCSS('scrollbar-width', 'none');
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height);
      await expect(left.getByRole('button', { name: '开始制作', exact: true })).toBeInViewport();
      await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      await expect(left.getByRole('button', { name: '开始制作', exact: true })).toBeInViewport();
      const leftScroll = await content.evaluate((element) => element.scrollTop);
      await list.hover();
      await page.mouse.wheel(0, 500);
      await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      expect(await content.evaluate((element) => element.scrollTop)).toBe(leftScroll);
      await list.evaluate((element) => { element.scrollTop = 0; });
      await list.focus();
      await page.keyboard.press('PageDown');
      await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      expect(await page.evaluate(() => scrollY)).toBe(0);
    } else {
      await expect(list).toHaveCSS('scrollbar-width', 'thin');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
      expect(await left.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
    }
    expect((await page.getByRole('banner').boundingBox())!.y).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await list.evaluate((element) => { element.scrollTop = 180; });
    const refreshedBounds = (await refresh.boundingBox())!;
    expect((await list.boundingBox())!.y - refreshedBounds.y - refreshedBounds.height).toBe(16);
    await mkdir('../artifacts/detail-scroll', { recursive: true });
    await page.screenshot({ path: `../artifacts/detail-scroll/${width}-${height}.png` });
  });
}
