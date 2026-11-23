const { test, expect } = require('@playwright/test');
const { add, cart, open, money } = require('./helpers');
const { knownBug } = require('./bugs');

for (const [value, status] of [['-1', 400], ['1.5', 400], ['9999', 409]]) {
  test('карточка: количество ' + value + ' отклоняется без изменения корзины', async ({ page }) => {
    await add(page, 1);
    await page.getByRole('spinbutton', { name: 'Количество', exact: true }).fill(value);
    const response = page.waitForResponse(r => r.url().endsWith('/api/cart/items') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Добавить в корзину', exact: true }).click();
    expect((await response).status()).toBe(status);
    await expect(page.getByRole('status')).toContainText(status === 400 ? 'Некорректное количество' : 'В наличии только');
    await cart(page);
    await expect(page.getByRole('spinbutton')).toHaveValue('1');
    await expect(page.getByTestId('total')).toHaveText(money(890));
  });
}
for (const value of ['-1', '1.5']) {
  test('корзина: количество ' + value + ' отклоняется и восстанавливается', async ({ page }) => {
    await add(page, 1, 2);
    await cart(page);
    const response = page.waitForResponse(r => r.url().endsWith('/api/cart/items/1') && r.request().method() === 'PATCH');
    await page.getByRole('spinbutton').fill(value);
    await page.getByRole('spinbutton').press('Tab');
    expect((await response).status()).toBe(400);
    await expect(page.getByRole('status')).toHaveText('Некорректное количество');
    await expect(page.getByRole('spinbutton')).toHaveValue('2');
    await expect(page.getByTestId('total')).toHaveText(money(1780));
  });
}
test('корзина: уменьшение количества с 1 до 0 удаляет позицию', async ({ page }) => {
  await add(page, 1);
  await cart(page);
  await page.getByRole('button', { name: 'Уменьшить количество', exact: true }).click();
  await expect(page.getByTestId('cart-empty')).toBeVisible();
  await expect(page.getByTestId('cart-count')).toHaveText('0');
});
test('BUG-02: карточка: пустое количество не должно добавлять товар', async ({ page }) => {
  await open(page, '/product/1');
  await page.getByRole('spinbutton', { name: 'Количество', exact: true }).fill('');
  const response = page.waitForResponse(r => r.url().endsWith('/api/cart/items') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Добавить в корзину', exact: true }).click();
  const status = (await response).status();
  knownBug('BUG-02');
  expect(status).toBe(400);
  await expect(page.getByTestId('cart-count')).toHaveText('0');
});
test('BUG-05: корзина: пустое поле не должно молча удалять позицию', async ({ page }) => {
  await add(page, 1, 2);
  await cart(page);
  const response = page.waitForResponse(r => r.url().endsWith('/api/cart/items/1') && r.request().method() === 'PATCH');
  await page.getByRole('spinbutton').fill('');
  await page.getByRole('spinbutton').press('Tab');
  const status = (await response).status();
  knownBug('BUG-05');
  expect(status).toBe(400);
  await expect(page.getByRole('spinbutton')).toHaveValue('2');
  await expect(page.getByTestId('total')).toHaveText(money(1780));
});
