import { test, expect } from '@playwright/test';

test('browse real templates, filter categories and open their requirements', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '模板库', exact: true })).toBeVisible();
  await expect(page.getByText('演示模板使用预置结果，不对上传图片进行真实合成。', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /山野明信片/ })).toBeVisible();
  await page.getByRole('link', { name: '创意设计', exact: true }).click();
  await expect(page).toHaveURL(/category=design/);
  await expect(page.getByRole('link', { name: /山野明信片/ })).toHaveCount(0);
  await page.getByRole('link', { name: /三格灵感板/ }).click();
  await expect(page.getByRole('heading', { name: '三格灵感板', exact: true })).toBeVisible();
  await expect(page.getByText('需要 3 张图片', { exact: true })).toBeVisible();
  await expect(page.getByText(/请先完成 \d+ 张图片的上传。/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开始制作', exact: true })).toBeDisabled();
});

test('empty category and missing template have usable return paths', async ({ page }) => {
  await page.goto('/?category=unknown-category');
  await expect(page.getByRole('heading', { name: '这个分类还没有模板', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '查看全部模板', exact: true }).click();
  await expect(page.getByRole('link', { name: /山野明信片/ })).toBeVisible();
  await page.goto('/templates/missing-template');
  await expect(page.getByRole('heading', { name: '模板不存在', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '← 返回模板库', exact: true }).click();
  await expect(page.getByRole('heading', { name: '模板库', exact: true })).toBeVisible();
});
