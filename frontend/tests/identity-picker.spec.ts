import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { gate } from './helpers';

const users = [{ id: 'demo-alice', displayName: '小禾' }, { id: 'demo-bob', displayName: '阿远' }];

async function mockIdentity(page: Page) {
  let user = users[0];
  const writes: string[] = [];
  await page.route('**/api/demo-users', (route) => route.fulfill({ json: { items: users } }));
  await page.route('**/api/session', (route) => {
    if (route.request().method() === 'POST') {
      const id = route.request().postDataJSON().userId;
      writes.push(id);
      user = users.find((item) => item.id === id)!;
    }
    return route.fulfill({ json: user });
  });
  await page.route((url) => url.pathname === '/api/tasks', (route) => route.fulfill({ json: { items: [], nextCursor: null } }));
  await page.route('**/api/tasks/active*', (route) => route.fulfill({ json: { items: [] } }));
  return writes;
}

for (const width of [1440, 390, 320]) {
  test(`custom identity popup and restrained mouse focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const writes = await mockIdentity(page);
    await page.goto('/');
    const trigger = page.getByRole('combobox', { name: '演示身份', exact: true });
    await expect(trigger).toHaveText('小禾');
    const header = (await page.getByRole('banner').boundingBox())!;
    await trigger.click();
    await expect(page.getByRole('listbox', { name: '演示身份' })).toBeVisible();
    await expect(page.locator('select#demo-identity')).toHaveCount(0);
    await expect(trigger).toHaveCSS('outline-style', 'none');
    await expect(page.getByRole('option', { name: '小禾', exact: true })).toHaveAttribute('aria-selected', 'true');
    const popup = (await page.getByRole('listbox').boundingBox())!;
    expect(popup.x).toBeGreaterThanOrEqual(0);
    expect(popup.x + popup.width).toBeLessThanOrEqual(width);
    expect((await page.getByRole('banner').boundingBox())!.height).toBe(header.height);
    await mkdir('../artifacts/identity-picker', { recursive: true });
    await page.screenshot({ path: `../artifacts/identity-picker/open-${width}.png`, animations: 'disabled' });
    await page.getByRole('option', { name: '阿远', exact: true }).click();
    await expect(trigger).toHaveText('阿远');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(writes).toEqual(['demo-bob']);
    await trigger.click();
    await page.mouse.click(width - 20, header.height + 20);
    await expect(page.getByRole('listbox')).toHaveCount(0);
    expect(writes).toEqual(['demo-bob']);
    await page.reload();
    await expect(trigger).toHaveText('阿远');
  });
}

test('keyboard selection, cancellation, busy state and upload prompt focus remain usable', async ({ page }) => {
  const writes = await mockIdentity(page);
  await page.goto('/');
  const trigger = page.getByRole('combobox', { name: '演示身份', exact: true });
  await expect(trigger).toBeEnabled();
  await page.getByRole('link', { name: '我的素材', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveCSS('outline-offset', '0px');
  await trigger.press('ArrowDown');
  await trigger.press('End');
  await expect(trigger).toHaveAttribute('aria-activedescendant', /option-2$/);
  await trigger.press('Escape');
  await expect(trigger).toHaveText('小禾');
  expect(writes).toHaveLength(0);
  await trigger.press('Enter');
  await trigger.press('End');
  await trigger.press('Enter');
  await expect(trigger).toHaveText('阿远');
  await expect(trigger).toBeFocused();
  await trigger.press('Space');
  await trigger.press('ArrowUp');
  await trigger.press('Tab');
  await expect(trigger).toHaveText('小禾');
  await expect(page.getByRole('listbox')).toHaveCount(0);

  const release = gate();
  let pendingWrites = 0;
  await page.route('**/api/session', async (route) => {
    if (route.request().method() === 'POST') {
      pendingWrites += 1;
      await release.promise;
    }
    return route.fulfill({ json: users[1] });
  });
  await trigger.click();
  await page.getByRole('option', { name: '阿远', exact: true }).click();
  await expect(trigger).toBeDisabled();
  await trigger.press('Enter');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  expect(pendingWrites).toBe(1);
  release.release();
  await expect(trigger).toHaveText('阿远');
  await expect(trigger).toBeEnabled();

  await page.route('**/api/session', (route) => route.fulfill({ status: 401, json: { code: 'UNAUTHENTICATED', message: '请选择身份' } }));
  await page.goto('/templates/mountain-card');
  await expect(trigger).toHaveText('选择身份');
  await page.getByRole('region', { name: '制作区域', exact: true }).getByLabel('图片 1', { exact: true }).click();
  await page.getByRole('button', { name: '去选择身份', exact: true }).click();
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
});

test('identity list errors can be retried before opening the selector', async ({ page }) => {
  await mockIdentity(page);
  let failed = true;
  await page.route('**/api/demo-users', (route) => route.fulfill(failed
    ? { status: 503, json: { code: 'UNAVAILABLE', message: '身份列表暂时不可用' } }
    : { json: { items: users } }));
  await page.goto('/');
  const trigger = page.getByRole('combobox', { name: '演示身份', exact: true });
  await expect(trigger).toBeDisabled();
  await expect(page.getByRole('banner').getByRole('alert')).toContainText('身份列表加载失败');
  failed = false;
  await page.getByRole('button', { name: '重试身份列表', exact: true }).click();
  await expect(trigger).toBeEnabled();
  await trigger.click();
  await expect(page.getByRole('option')).toHaveCount(3);
});

test.describe('touch identity selector', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('tap opens the menu and selects an identity', async ({ page }) => {
    const writes = await mockIdentity(page);
    await page.goto('/');
    const trigger = page.getByRole('combobox', { name: '演示身份', exact: true });
    await expect(trigger).toBeEnabled();
    await trigger.tap();
    await page.getByRole('option', { name: '阿远', exact: true }).tap();
    await expect(trigger).toHaveText('阿远');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    expect(writes).toEqual(['demo-bob']);
  });
});
