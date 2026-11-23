const { test, expect } = require('@playwright/test');
const { open, add, checkout, register } = require('./helpers');
function knownBug(id) { test.fail(process.env.STRICT_BUGS !== '1', id + ': see README'); }

test('BUG-01: поле адреса должно скрываться при самовывозе', async ({ page }) => {
  await add(page, 1);
  await checkout(page);
  await expect(page.getByTestId('shipping')).toHaveText('бесплатно');
  await expect(page.locator('#address-row')).toHaveAttribute('hidden', '');
  knownBug('BUG-01');
  await expect(page.getByLabel('Адрес доставки')).toBeHidden();
});

test('BUG-02: нулевое количество должно отклоняться', async ({ page }) => {
  await open(page, '/product/1');
  await page.getByRole('spinbutton', { name: 'Количество', exact: true }).fill('0');
  const response = page.waitForResponse(r => r.url().endsWith('/api/cart/items') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Добавить в корзину', exact: true }).click();
  const status = (await response).status();
  knownBug('BUG-02');
  expect(status).toBe(400);
  await expect(page.getByTestId('cart-count')).toHaveText('0');
});

test('BUG-03: другой аккаунт не должен видеть чужой заказ', async ({ page }) => {
  const emailA = await register(page);
  await add(page, 13);
  await checkout(page);
  await page.getByRole('button', { name: 'Подтвердить заказ' }).click();
  await expect(page.getByTestId('order-success')).toBeVisible();
  const id = await page.getByTestId('order-id').innerText();
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.locator('#nav-login')).toBeVisible();
  const emailB = await register(page);
  expect(emailB).not.toBe(emailA);
  const me = await (await page.request.get('/api/auth/me')).json();
  expect(me.user.email).toBe(emailB);
  await open(page, '/order/' + id);
  knownBug('BUG-03');
  await expect(page.getByRole('heading', { name: 'Заказ не найден', exact: true })).toBeVisible();
});

test('BUG-04: телефон из одной цифры и дефисов отклоняется', async ({ page }) => {
  await add(page, 13);
  await checkout(page);
  await page.getByLabel('Телефон', { exact: true }).fill('1---------');
  const response = page.waitForResponse(r => r.url().endsWith('/api/orders') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Подтвердить заказ' }).click();
  const status = (await response).status();
  knownBug('BUG-04');
  expect(status).toBe(400);
  await expect(page.locator('[data-field="phone"]')).toBeVisible();
});
