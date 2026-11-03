import { expect, test } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { mountain, coast, gate } from './helpers';
import { taskFixture } from './fixtures/tasks';

for (const width of [1440, 390, 320]) {
  test(`batch upload uses one entry and an ordered thumbnail grid at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 768 });
    await page.route('**/api/session', (route) => route.fulfill({ json: { id: 'demo-alice', displayName: '小禾' } }));
    await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill({ json: { items: [], nextCursor: null } }));
    await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [] } }));
    let uploads = 0;
    await page.route('**/api/assets', (route) => {
      uploads += 1;
      return route.fulfill({ status: 201, json: {
        id: `00000000-0000-4000-8000-${String(uploads).padStart(12, '0')}`,
        originalName: 'image.png', mimeType: 'image/png', sizeBytes: 100, previewUrl: '/api/assets/mock/content',
      } });
    });
    await page.goto('/templates/inspiration-grid');
    const form = page.getByRole('region', { name: '制作区域', exact: true });
    await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveValue('demo-alice');
    await expect(form.locator('input[type="file"]')).toHaveCount(1);
    const first = form.getByLabel('图片 1', { exact: true });
    await expect(first).toHaveAttribute('multiple', '');
    const submit = form.getByRole('button', { name: '开始制作', exact: true });
    if (width > 1000) await expect(submit).toBeInViewport();
    await first.setInputFiles([mountain, coast, mountain, coast]);
    await expect(form.getByRole('alert')).toContainText('最多还能添加 3 张');
    expect(uploads).toBe(0);
    await first.setInputFiles([mountain, coast]);
    await expect(form.getByText('上传成功', { exact: true })).toHaveCount(2);
    await expect(submit).toBeDisabled();
    await expect(form.getByText('添加图片', { exact: true })).toBeVisible();
    const firstBox = (await form.getByRole('group', { name: '图片 1', exact: true }).boundingBox())!;
    const secondBox = (await form.getByRole('group', { name: '图片 2', exact: true }).boundingBox())!;
    expect(secondBox.y).toBe(firstBox.y);
    expect(secondBox.x).toBeGreaterThan(firstBox.x);
    await form.getByLabel('图片 3', { exact: true }).setInputFiles({
      name: 'long-image-name-for-preview.png', mimeType: 'image/png', buffer: await readFile(mountain),
    });
    await expect(form.getByText('上传成功', { exact: true })).toHaveCount(3);
    await expect(submit).toBeEnabled();
    await expect(form.getByText('添加图片', { exact: true })).toHaveCount(0);
    if (width > 1000) {
      await expect(submit).toBeInViewport();
      const y = (await submit.boundingBox())!.y;
      await form.getByRole('region', { name: '模板与上传内容', exact: true }).evaluate((element) => { element.scrollTop = element.scrollHeight; });
      expect((await submit.boundingBox())!.y).toBe(y);
    }
    await mkdir('../artifacts/upload-gallery', { recursive: true });
    await page.screenshot({ path: `../artifacts/upload-gallery/three-${width}.png`, fullPage: true, animations: 'disabled' });
    await form.getByRole('button', { name: '移除图片 2', exact: true }).click();
    await expect(form.getByLabel('图片 2', { exact: true })).toBeFocused();
    await expect(form.getByRole('group', { name: '图片 3', exact: true })).toContainText('long-image-name');
    await form.getByLabel('图片 2', { exact: true }).setInputFiles(coast);
    await expect(submit).toBeEnabled();
    expect(uploads).toBe(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test('shared upload entry asks for identity before opening a file chooser', async ({ page }) => {
  await page.route('**/api/session', (route) => route.fulfill({ status: 401, json: { code: 'UNAUTHENTICATED', message: '请选择身份' } }));
  await page.goto('/templates/inspiration-grid');
  const form = page.getByRole('region', { name: '制作区域', exact: true });
  const input = form.getByLabel('图片 1', { exact: true });
  await expect(input).toBeEnabled();
  let choosers = 0;
  page.on('filechooser', () => { choosers += 1; });
  await form.getByRole('group', { name: '图片 1', exact: true }).click({ position: { x: 8, y: 60 } });
  const dialog = page.getByRole('dialog', { name: '请先选择身份', exact: true });
  await expect(dialog).toBeVisible();
  expect(choosers).toBe(0);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(input).toBeFocused();
});

test('batch keeps per-image validation and submits IDs in position order', async ({ page }) => {
  await page.route('**/api/session', (route) => route.fulfill({ json: { id: 'demo-alice', displayName: '小禾' } }));
  await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [] } }));
  const ids = [1, 2, 3].map((id) => `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`);
  let submitted: string[] = [];
  await page.route((url) => url.pathname === '/api/tasks', (route) => {
    if (route.request().method() === 'POST') {
      submitted = route.request().postDataJSON().assetIds;
      return route.fulfill({ status: 202, json: taskFixture(777, { templateId: 'inspiration-grid', templateTitle: '三格灵感板' }) });
    }
    return route.fulfill({ json: { items: [], nextCursor: null } });
  });
  await page.route('**/api/tasks/status*', (route) => route.fulfill({ json: { items: [], missingIds: [] } }));
  const first = gate();
  let reads = 0;
  await page.route('**/api/assets', async (route) => {
    reads += 1;
    const name = route.request().postDataBuffer()!.toString().match(/filename="([^"]+)"/)![1];
    const index = Number(name[0]) - 1;
    if (index === 0) await first.promise;
    await route.fulfill({ status: 201, json: {
      id: ids[index], originalName: name, mimeType: 'image/png', sizeBytes: 100, previewUrl: '/api/assets/mock/content',
    } });
  });
  await page.goto('/templates/inspiration-grid');
  await expect(page.getByRole('combobox', { name: '演示身份' })).toHaveValue('demo-alice');
  const form = page.getByRole('region', { name: '制作区域', exact: true });
  const bytes = await readFile(mountain);
  await form.getByLabel('图片 1', { exact: true }).setInputFiles([
    { name: '1.png', mimeType: 'image/png', buffer: bytes },
    { name: '2.png', mimeType: 'image/png', buffer: bytes },
    { name: '3.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') },
  ]);
  await expect(form.getByText('正在上传…', { exact: true })).toHaveCount(1);
  await expect(form.getByText('上传成功', { exact: true })).toHaveCount(1);
  await expect(form.getByRole('group', { name: '图片 3', exact: true }).getByRole('alert')).toContainText('JPEG / PNG');
  await expect(form.getByRole('button', { name: '开始制作', exact: true })).toBeDisabled();
  first.release();
  await expect(form.getByText('上传成功', { exact: true })).toHaveCount(2);
  expect(reads).toBe(2);
  await form.getByLabel('图片 3', { exact: true }).setInputFiles({ name: '3.png', mimeType: 'image/png', buffer: bytes });
  await expect(form.getByText('上传成功', { exact: true })).toHaveCount(3);
  await form.getByRole('button', { name: '开始制作', exact: true }).click();
  await expect(form.getByRole('region', { name: '提交回执', exact: true })).toBeVisible();
  expect(submitted).toEqual(ids);
});
