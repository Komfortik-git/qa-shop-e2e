const { test, expect } = require('@playwright/test');
const { open, add, cart, promo, money } = require('./helpers');

test('корзина: добавление, количество, суммы, перезагрузка и удаление', async ({ page }) => {
  await add(page, 1, 2);
  await expect(page.getByTestId('cart-count')).toHaveText('2');
  await cart(page);
  await expect(page.getByTestId('subtotal')).toHaveText(money(1780));
  await page.getByRole('button', { name: 'Увеличить количество', exact: true }).click();
  await expect(page.getByTestId('subtotal')).toHaveText(money(2670));
  await page.getByRole('button', { name: 'Уменьшить количество', exact: true }).click();
  await expect(page.getByTestId('subtotal')).toHaveText(money(1780));
  await page.reload();
  await expect(page.getByRole('spinbutton')).toHaveValue('2');
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page.getByTestId('cart-empty')).toBeVisible();
  await expect(page.getByTestId('cart-count')).toHaveText('0');
});
test('очистка нескольких товаров сбрасывает промокод', async ({ page }) => {
  await add(page, 1);
  await add(page, 4);
  await cart(page);
  await expect(page.getByTestId('cart-row')).toHaveCount(2);
  await promo(page, 'SALE10');
  await expect(page.getByTestId('discount')).toHaveText('−' + money(153));
  await page.getByRole('button', { name: 'Очистить корзину', exact: true }).click();
  await expect(page.getByTestId('cart-empty')).toBeVisible();
  await add(page, 1);
  await cart(page);
  await expect(page.getByTestId('discount')).toHaveCount(0);
});
test('превышение остатка отклоняется без изменения корзины', async ({ page }) => {
  await add(page, 1);
  await cart(page);
  await page.getByRole('spinbutton').fill('9999');
  await page.getByRole('spinbutton').press('Tab');
  await expect(page.getByRole('status')).toContainText('В наличии только');
  await expect(page.getByRole('spinbutton')).toHaveValue('1');
  await expect(page.getByTestId('total')).toHaveText(money(890));
});
test('разные браузерные сессии имеют отдельные корзины', async ({ page, browser, baseURL }) => {
  await add(page, 1);
  const context = await browser.newContext({ baseURL });
  try {
    const other = await context.newPage();
    await open(other, '/cart');
    await expect(other.getByTestId('cart-empty')).toBeVisible();
  } finally { await context.close(); }
});
test('SALE10: регистр, пробелы, точная скидка и отмена', async ({ page }) => {
  await add(page, 1, 2);
  await cart(page);
  await promo(page, ' sale10 ');
  await expect(page.getByTestId('discount')).toHaveText('−' + money(178));
  await expect(page.getByTestId('total')).toHaveText(money(1602));
  await promo(page, '');
  await expect(page.getByTestId('discount')).toHaveCount(0);
  await expect(page.getByTestId('total')).toHaveText(money(1780));
});
test('WELCOME500: ниже порога отклонён, на 2000 применён', async ({ page }) => {
  await add(page, 1);
  await cart(page);
  await promo(page, 'WELCOME500');
  await expect(page.getByRole('status')).toHaveText('Промокод действует при заказе от 2000 ₽');
  await expect(page.getByTestId('discount')).toHaveCount(0);
  await page.getByRole('button', { name: 'Очистить корзину' }).click();
  await expect(page.getByTestId('cart-empty')).toBeVisible();
  await add(page, 16);
  await cart(page);
  await promo(page, 'WELCOME500');
  await expect(page.getByTestId('discount')).toHaveText('−' + money(500));
  await expect(page.getByTestId('total')).toHaveText(money(1500));
});
test('неизвестный код не отменяет ранее применённую скидку', async ({ page }) => {
  await add(page, 1);
  await cart(page);
  await promo(page, 'SALE10');
  await expect(page.getByTestId('total')).toHaveText(money(801));
  await promo(page, 'NOT-A-PROMO');
  await expect(page.getByRole('status')).toHaveText('Промокод не найден');
  await expect(page.getByTestId('total')).toHaveText(money(801));
});
test('WELCOME500 перестаёт действовать после снижения суммы ниже порога', async ({ page }) => {
  await add(page, 1, 3);
  await cart(page);
  await promo(page, 'WELCOME500');
  await expect(page.getByTestId('total')).toHaveText(money(2170));
  await page.getByRole('button', { name: 'Уменьшить количество', exact: true }).click();
  await expect(page.getByTestId('total')).toHaveText(money(1780));
  await expect(page.getByTestId('discount')).toHaveCount(0);
});
