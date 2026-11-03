import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { gate } from './helpers';

for (const width of [1440, 390]) {
  for (const path of ['/', '/templates/mountain-card']) {
    test(`template cover failure and retry at ${width}px on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/api/session', (route) => route.fulfill({ status: 401, json: {} }));
      const release = gate();
      const attempts = new Set<string>();
      await page.route((url) => url.pathname === '/demo/covers/mountain-card.svg', async (route) => {
        const attempt = new URL(route.request().url()).searchParams.get('coverRetry') ?? 'initial';
        attempts.add(attempt);
        if (attempt === 'initial') return route.fulfill({ status: 503, body: 'unavailable' });
        if (attempt === '1') return route.fulfill({ contentType: 'image/svg+xml', body: 'invalid image' });
        await release.promise;
        await route.fulfill({ response: await route.fetch() });
      });
      await page.goto(path);
      const frame = page.getByRole('group', { name: '山野明信片封面', exact: true });
      const retry = frame.getByRole('button', { name: '重新加载山野明信片封面', exact: true });
      await expect(frame.getByText('封面加载失败', { exact: true })).toBeVisible();
      const before = (await frame.boundingBox())!;
      await mkdir('../artifacts/template-cover', { recursive: true });
      await page.screenshot({ path: `../artifacts/template-cover/${width}-${path === '/' ? 'catalog' : 'detail'}-failed.png`, animations: 'disabled' });
      if (path === '/') {
        await expect(page.getByRole('link', { name: /山野明信片/ })).toBeVisible();
        expect(await retry.evaluate((button) => button.closest('a'))).toBeNull();
      } else {
        await expect(page.getByRole('region', { name: '制作区域', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: '开始制作', exact: true })).toBeVisible();
      }
      await retry.focus();
      await retry.press('Enter');
      await expect.poll(() => attempts.has('1')).toBe(true);
      await expect(retry).toBeEnabled();
      await expect(frame.getByText('封面加载失败', { exact: true })).toBeVisible();
      await retry.click();
      await expect(frame.getByText('正在重新加载…', { exact: true })).toBeVisible();
      await expect(retry).toBeDisabled();
      expect(new URL(page.url()).pathname).toBe(path);
      release.release();
      await expect(retry).toHaveCount(0);
      await expect(frame).toBeFocused();
      await expect.poll(() => frame.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
      const after = (await frame.boundingBox())!;
      expect(after.width).toBe(before.width);
      expect(after.height).toBe(before.height);
      expect([...attempts]).toEqual(['initial', '1', '2']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      if (path === '/') {
        await page.getByRole('link', { name: /山野明信片/ }).click();
        await expect(page).toHaveURL(/\/templates\/mountain-card$/);
      }
    });
  }
}
