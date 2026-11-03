import { expect, test } from '@playwright/test';
import { coast, finishResponseAndRender, gate, ignoreTransportCancellation, mountain, openCreation, readyImage } from './helpers';

test('a replaced upload cannot overwrite the replacement even if cancellation is ignored', async ({ page }) => {
  await ignoreTransportCancellation(page);
  const started = gate();
  const release = gate();
  const delivered = gate();
  let count = 0;
  await page.route('**/api/assets', async (route) => {
    if (++count !== 1) return route.continue();
    const response = await route.fetch();
    started.release();
    await release.promise;
    await route.fulfill({ response });
    delivered.release();
  });
  await openCreation(page);
  await page.getByLabel('图片 1', { exact: true }).setInputFiles(mountain);
  await started.promise;
  await expect(page.getByRole('button', { name: '开始制作', exact: true })).toBeDisabled();
  await page.getByLabel('图片 1', { exact: true }).setInputFiles(coast);
  await expect(page.getByText('上传成功', { exact: true })).toBeVisible();
  const lateResponse = page.waitForResponse('**/api/assets');
  release.release();
  await delivered.promise;
  await finishResponseAndRender(page, await lateResponse);
  await expect(page.getByRole('group', { name: '图片 1', exact: true })).toContainText('coast.png');
  await expect(page.getByText('mountain.png', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '开始制作', exact: true }).click();
  await expect(page.getByRole('region', { name: '提交回执' })).toBeVisible();
});

test('switching identity invalidates an old upload and clears private form state', async ({ page }) => {
  await ignoreTransportCancellation(page);
  const started = gate();
  const release = gate();
  const delivered = gate();
  await page.route('**/api/assets', async (route) => {
    const response = await route.fetch();
    started.release();
    await release.promise;
    await route.fulfill({ response });
    delivered.release();
  });
  await openCreation(page);
  await page.getByLabel('图片 1', { exact: true }).setInputFiles(mountain);
  await started.promise;
  await page.getByRole('combobox', { name: '演示身份' }).selectOption('demo-bob');
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveValue('demo-bob');
  const lateResponse = page.waitForResponse('**/api/assets');
  release.release();
  await delivered.promise;
  await finishResponseAndRender(page, await lateResponse);
  await expect(page.getByText('已选 0 / 1 张', { exact: true })).toBeVisible();
  await expect(page.getByText('mountain.png', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开始制作', exact: true })).toBeDisabled();
});

test('pending submission is single-flight and a late receipt cannot enter another identity', async ({ page }) => {
  await ignoreTransportCancellation(page);
  const started = gate();
  const release = gate();
  const delivered = gate();
  let writes = 0;
  await page.route('**/api/tasks', async (route) => {
    writes += 1;
    const response = await route.fetch();
    started.release();
    await release.promise;
    await route.fulfill({ response });
    delivered.release();
  });
  await openCreation(page);
  await readyImage(page);
  // Two submit events in one turn exercise the guard before React can disable the button.
  await page.locator('form').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await started.promise;
  await expect(page.getByRole('button', { name: '正在提交…', exact: true })).toBeDisabled();
  await expect(page.getByLabel('图片 1', { exact: true })).toBeDisabled();
  await page.getByRole('combobox', { name: '演示身份' }).selectOption('demo-bob');
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveValue('demo-bob');
  const lateResponse = page.waitForResponse('**/api/tasks');
  release.release();
  await delivered.promise;
  await finishResponseAndRender(page, await lateResponse);
  await expect(page.getByText('已选 0 / 1 张', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '提交回执' })).toHaveCount(0);
  expect(writes).toBe(1);
});

test('template navigation and return discard previously uploaded material', async ({ page }) => {
  await openCreation(page);
  await readyImage(page);
  await page.getByRole('link', { name: '返回模板库', exact: true }).click();
  await page.getByRole('link', { name: /海边双拼/ }).click();
  await expect(page.getByText('已选 0 / 2 张', { exact: true })).toBeVisible();
  await expect(page.getByText('mountain.png', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: '返回模板库', exact: true }).click();
  await page.getByRole('link', { name: /山野明信片/ }).click();
  await expect(page.getByText('已选 0 / 1 张', { exact: true })).toBeVisible();
});
