const { test, expect } = require('@playwright/test');
const { open, add, cart, promo, register, checkout, money } = require('./helpers');

test('регистрация, сохранение входа, выход и повторный вход', async ({ page }) => {
  const email = await register(page);
  await page.reload();
  await expect(page.locator('#user-name')).toHaveText('Тестовый Покупатель');
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.locator('#user-name')).toBeHidden();
  await page.getByRole('link', { name: 'Войти', exact: true }).click();
  await page.getByLabel('E-mail', { exact: true }).fill(email.toUpperCase());
  await page.getByLabel('Пароль', { exact: true }).fill('Qa-shop-test-2026!');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.locator('#user-name')).toHaveText('Тестовый Покупатель');
});
test('регистрация: обязательные поля и повторный email', async ({ page }) => {
  await open(page, '/register');
  await page.getByRole('button', { name: 'Зарегистрироваться', exact: true }).click();
  await expect(page.locator('.field-error')).toHaveCount(3);
  await expect(page.getByRole('alert')).toHaveText('Проверьте поля формы');
  const email = await register(page);
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.locator('#nav-login')).toBeVisible();
  await open(page, '/register');
  await page.getByLabel('Имя', { exact: true }).fill('Другой Покупатель');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill('Qa-shop-test-2026!');
  await page.getByRole('button', { name: 'Зарегистрироваться', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Пользователь с таким e-mail уже зарегистрирован');
});
test('неверный пароль не авторизует пользователя', async ({ page }) => {
  const email = await register(page);
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.locator('#nav-login')).toBeVisible();
  await open(page, '/login');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Неверный e-mail или пароль');
  await expect(page.locator('#nav-orders')).toBeHidden();
});
test('гостю недоступна история заказов, пустую корзину нельзя оформить', async ({ page }) => {
  await open(page, '/orders');
  await expect(page.getByRole('heading', { name: 'Вход', exact: true })).toBeVisible();
  await open(page, '/checkout');
  await expect(page.getByTestId('cart-empty')).toBeVisible();
});
test('оформление: обязательные поля и переключение способов доставки', async ({ page }) => {
  await add(page, 1);
  await cart(page);
  await page.getByRole('link', { name: 'Оформить заказ' }).click();
  await expect(page.getByTestId('shipping')).toHaveText(money(300));
  await page.getByRole('button', { name: 'Подтвердить заказ' }).click();
  await expect(page.locator('.field-error')).toHaveCount(3);
  await expect(page.getByRole('alert')).toHaveText('Проверьте поля формы');
  await page.getByLabel('Самовывоз', { exact: true }).check();

  await expect(page.getByTestId('shipping')).toHaveText('бесплатно');
  await expect(page.getByTestId('total')).toHaveText(money(890));
});
test('порог бесплатной доставки считается после скидки', async ({ page }) => {
  await add(page, 9, 7); // 3150 → 2835 после SALE10: доставка 300
  await cart(page);
  await page.getByRole('link', { name: 'Оформить заказ' }).click();
  await expect(page.getByTestId('shipping')).toHaveText('бесплатно');
  await cart(page);
  await promo(page, 'SALE10');
  await expect(page.getByTestId('total')).toHaveText(money(2835));
  await page.getByRole('link', { name: 'Оформить заказ' }).click();
  await expect(page.getByTestId('shipping')).toHaveText(money(300));
  await expect(page.getByTestId('total')).toHaveText(money(3135));
});
for (const delivery of ['courier', 'pickup']) {
  test(`гостевой заказ ${delivery}: сумма, очищенная корзина и остаток`, async ({ page }) => {
    await open(page);
    const before = await (await page.request.get('/api/products/13')).json();
    await add(page, 13);
    await checkout(page, { delivery, payment: delivery === 'courier' ? 'card' : 'cash' });
    const response = page.waitForResponse(r => r.url().endsWith('/api/orders') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Подтвердить заказ' }).click();
    const order = await (await response).json();
    await expect(page.getByTestId('order-success')).toBeVisible();
    await expect(page.getByTestId('total')).toHaveText(money(delivery === 'courier' ? 620 : 320));
    await expect(page.getByTestId('cart-count')).toHaveText('0');
    expect(order).toMatchObject({ subtotal: 320, discount: 0, delivery, shipping: delivery === 'courier' ? 300 : 0 });
    const after = await (await page.request.get('/api/products/13')).json();
    expect(after.stock).toBe(before.stock - 1);
    await page.reload();
    await expect(page.getByTestId('order-id')).toHaveText(String(order.id));
    await cart(page);
    await expect(page.getByTestId('cart-empty')).toBeVisible();
  });
}
test('заказ с промокодом появляется в истории аккаунта', async ({ page }) => {
  await register(page);
  await add(page, 16);
  await cart(page);
  await promo(page, 'WELCOME500');
  await expect(page.getByTestId('total')).toHaveText(money(1500));
  await checkout(page);
  await page.getByRole('button', { name: 'Подтвердить заказ' }).click();
  await expect(page.getByTestId('order-success')).toBeVisible();
  const id = await page.getByTestId('order-id').innerText();
  await page.getByRole('link', { name: 'Мои заказы', exact: true }).click();
  await expect(page.getByTestId('order-row')).toHaveCount(1);
  await expect(page.getByTestId('order-row')).toContainText(money(1500));
  await page.getByRole('link', { name: '№' + id, exact: true }).click();
  await expect(page.getByTestId('discount')).toHaveText('−' + money(500));
});
