const { expect } = require('@playwright/test');
const money = n => n.toLocaleString('ru-RU') + ' ₽';
async function open(page, route = '/') {
  await page.goto('/#' + route);
  await expect(page.locator('#app h1')).toBeVisible();
}
async function add(page, id = 1, qty = 1) {
  await open(page, '/product/' + id);
  await expect(page.getByRole('heading', { name: require('../products.json').find(p => p.id === id).name, exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Количество', exact: true }).fill(String(qty));
  const response = page.waitForResponse(r => r.url().endsWith('/api/cart/items') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Добавить в корзину', exact: true }).click();
  expect((await response).status()).toBe(201);
  await expect(page.getByRole('status')).toHaveText('Товар добавлен в корзину');
}
async function cart(page) {
  await page.getByTestId('cart-link').click();
  await expect(page.getByRole('heading', { name: 'Корзина', exact: true })).toBeVisible();
}
async function promo(page, code) {
  await page.getByRole('textbox', { name: 'Промокод' }).fill(code);
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
}
async function register(page) {
  const email = `qa-${Date.now()}-${require('node:crypto').randomUUID()}@example.test`;
  await open(page, '/register');
  await page.locator('#auth input[name="name"]').fill('Тестовый Покупатель');
  await page.locator('#auth input[name="email"]').fill(email);
  await page.locator('#auth input[name="password"]').fill('Qa-shop-test-2026!');
  await page.getByRole('button', { name: 'Зарегистрироваться', exact: true }).click();
  await expect(page.locator('#user-name')).toHaveText('Тестовый Покупатель');
  return email;
}
async function checkout(page, { delivery = 'pickup', payment = 'cash' } = {}) {
  await cart(page);
  await page.getByRole('link', { name: 'Оформить заказ', exact: true }).click();
  // The form appears before the initial delivery calculation and route scroll finish.
  await expect(page.locator('#checkout').getByTestId('total')).toBeVisible();
  await page.getByLabel('Имя получателя').fill('Тестовый Покупатель');
  await page.getByLabel('Телефон', { exact: true }).fill('+7 900 000-00-00');
  const deliveryOption = page.getByLabel(delivery === 'pickup' ? 'Самовывоз' : 'Курьером', { exact: true });
  // Click the visible label, then verify the actual radio state (also on Firefox/Linux).
  await deliveryOption.locator('..').click();
  await expect(deliveryOption).toBeChecked();
  if (delivery === 'courier') await page.getByLabel('Адрес доставки').fill('Тестовый адрес, дом 1');
  const paymentOption = page.getByLabel(payment === 'cash' ? 'Наличными' : 'Картой при получении', { exact: true });
  await paymentOption.locator('..').click();
  await expect(paymentOption).toBeChecked();
}
module.exports = { money, open, add, cart, promo, register, checkout };
