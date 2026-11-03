import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { taskFixture, failedTask } from './fixtures/tasks';
import { mountain, coast } from './helpers';

for (const width of [1440, 390]) {
  test(`upload and result image dialogs preserve task states at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const tasks = [
      taskFixture(601, { status: 'SUCCEEDED', version: 6, stage: 'RESULT_FINALIZATION',
        finishedAt: '2026-11-02T06:00:03.000Z', resultUrl: '/demo/results/mountain-card.svg' }),
      failedTask(602),
      taskFixture(603, { status: 'RUNNING', stage: 'MOCK_GENERATION', version: 2 }),
      taskFixture(604),
    ];
    await page.route('**/api/session', (route) => route.fulfill({ json: { id: 'demo-alice', displayName: '小禾' } }));
    await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill({ json: { items: tasks, nextCursor: null } }));
    await page.route('**/api/tasks/active', (route) => route.fulfill({ json: { items: [] } }));
    await page.route('**/api/tasks/status*', (route) => route.fulfill({ json: { items: tasks.slice(2), missingIds: [] } }));
    await page.route('**/api/assets', (route) => route.fulfill({ status: 201, json: {
      id: '00000000-0000-4000-8000-000000000999', originalName: 'image.png',
      mimeType: 'image/png', sizeBytes: 100, previewUrl: '/api/assets/mock/content',
    } }));
    await page.goto('/templates/mountain-card');
    await expect(page.getByRole('article')).toHaveCount(4);
    await expect(page.getByText('任务详情', { exact: true })).toHaveCount(0);
    for (const label of ['等待处理', '处理中', '制作成功', '制作失败', '演示生成失败']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByText('模拟生成', { exact: true })).toHaveCount(2);
    const form = page.getByRole('region', { name: '制作区域', exact: true });
    const input = form.getByLabel('图片 1', { exact: true });
    const slot = form.getByRole('group', { name: '图片 1', exact: true });
    const emptyHeight = (await slot.boundingBox())!.height;
    await input.setInputFiles(mountain);
    await expect(form.getByText('上传成功', { exact: true })).toBeVisible();
    const upload = form.getByRole('button', { name: '放大查看图片 1 预览', exact: true });
    const thumbnailBounds = await upload.boundingBox();
    expect(thumbnailBounds!.width).toBe(width > 1000 ? 100 : 72);
    expect(thumbnailBounds!.height).toBe(width > 1000 ? 90 : 80);
    const replaceBounds = (await input.boundingBox())!;
    const removeBounds = (await form.getByRole('button', { name: '移除图片 1', exact: true }).boundingBox())!;
    expect(Math.abs(replaceBounds.y - removeBounds.y)).toBeLessThan(1);
    expect(removeBounds.x).toBeGreaterThan(replaceBounds.x + replaceBounds.width);
    expect((await slot.boundingBox())!.height).toBeLessThan(155);
    await upload.click();
    const dialog = page.getByRole('dialog', { name: '图片 1 预览', exact: true });
    await expect(dialog).toBeVisible();
    const firstSource = await dialog.getByRole('img').getAttribute('src');
    await expect(dialog.getByRole('img')).toHaveCSS('object-fit', 'contain');
    await mkdir('../artifacts/image-preview', { recursive: true });
    await page.screenshot({ path: `../artifacts/image-preview/${width}-upload.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(upload).toBeFocused();
    await page.screenshot({ path: `../artifacts/image-preview/${width}-workspace.png` });
    await input.setInputFiles(coast);
    await upload.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    expect(await dialog.getByRole('img').getAttribute('src')).not.toBe(firstSource);
    await dialog.getByRole('button', { name: '关闭预览', exact: true }).click();
    await expect(upload).toBeFocused();
    await form.getByRole('button', { name: '移除图片 1', exact: true }).click();
    await expect(upload).toHaveCount(0);
    expect((await slot.boundingBox())!.height).toBe(emptyHeight);

    for (const routePath of ['/templates/mountain-card', '/history']) {
      if (routePath === '/history') await page.goto(routePath);
      const trigger = page.getByRole('button', { name: '放大查看山野明信片制作结果', exact: true });
      await trigger.click();
      const result = page.getByRole('dialog', { name: '山野明信片制作结果', exact: true });
      await expect(result).toBeVisible();
      await expect.poll(() => result.getByRole('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
      await expect(result.getByRole('img')).toHaveCSS('object-fit', 'contain');
      await mkdir('../artifacts/image-preview', { recursive: true });
      await page.screenshot({ path: `../artifacts/image-preview/${width}-${routePath === '/history' ? 'history' : 'detail'}.png` });
      await page.mouse.click(2, 2);
      await expect(result).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await expect(page.getByText('任务详情', { exact: true })).toHaveCount(0);
    }
  });
}
