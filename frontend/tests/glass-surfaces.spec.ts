import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const width of [1440, 390, 320]) {
  test(`glass navigation stays readable and usable over scrolled content at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 600 });
    await page.route('**/api/session', (route) => route.fulfill({ status: 401, json: {} }));
    await page.goto('/');
    const header = page.getByRole('banner');
    const trigger = page.getByRole('combobox', { name: '演示身份' });
    await expect(trigger).toBeEnabled();
    const originalHeight = (await header.boundingBox())!.height;
    await page.evaluate(() => window.scrollTo(0, 180));
    expect((await header.boundingBox())!.y).toBe(0);
    await trigger.click();
    const menu = page.getByRole('listbox', { name: '演示身份' });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveCSS('backdrop-filter', 'blur(24px) saturate(1.3)');
    expect((await header.boundingBox())!.height).toBe(originalHeight);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await mkdir('../artifacts/glass-surfaces', { recursive: true });
    await page.screenshot({ path: `../artifacts/glass-surfaces/scrolled-${width}.png`, animations: 'disabled' });
    await trigger.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await trigger.press('Enter');
    await expect(menu).toHaveCSS('animation-name', 'none');
  });
}
