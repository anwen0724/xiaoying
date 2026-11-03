import { expect, type Page } from '@playwright/test';
import path from 'node:path';

export const mountain = path.resolve('../assets/demo/inputs/mountain.png');
export const coast = path.resolve('../assets/demo/inputs/coast.png');

export function gate() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

export async function openCreation(page: Page) {
  await page.goto('/templates/mountain-card');
  await page.getByRole('combobox', { name: '演示身份' }).selectOption('demo-alice');
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveValue('demo-alice');
}

export async function readyImage(page: Page) {
  await page.getByRole('region', { name: '制作区域', exact: true })
    .getByLabel('图片 1', { exact: true }).setInputFiles(mountain);
  await expect(page.getByText('上传成功', { exact: true })).toBeVisible();
}

export async function finishResponseAndRender(page: Page, response: import('@playwright/test').Response) {
  await response.finished();
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

/** Simulates a transport that completes despite cancellation; feature code stays unmodified. */
export async function ignoreTransportCancellation(page: Page) {
  await page.addInitScript(() => {
    const original = window.fetch;
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const pathname = new URL(url, window.location.href).pathname;
      return original(input, pathname === '/api/assets' || pathname.startsWith('/api/tasks')
        ? { ...init, signal: null } : init);
    };
  });
}
