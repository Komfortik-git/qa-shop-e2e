const { test, expect } = require('@playwright/test');
const { open, add, cart, promo, checkout, register, money } = require('./helpers');
const { knownBug } = require('./bugs');

test('мобильный каталог: поиск и категория', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('product-card')).toHaveCount(16);
  await page.getByRole('searchbox').fill('Ассам');
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  await page.getByLabel('Категория', { exact: true }).selectOption('coffee');
  await expect(page.getByTestId('empty-list')).toBeVisible();
  await page.getByLabel('Категория', { exact: true }).selectOption('tea');
  await expect(page.getByTestId('product-card')).toHaveCount(1);
});

test('мобильный заказ: количество, SALE10, самовывоз и очистка корзины', async ({ page }) => {
  await add(page, 1, 2);
  await cart(page);
  await expect(page.getByTestId('subtotal')).toHaveText(money(1780));
  await promo(page, 'SALE10');
  await expect(page.getByTestId('total')).toHaveText(money(1602));
  await checkout(page);
  await page.getByRole('button', { name: 'Подтвердить заказ', exact: true }).click();
  await expect(page.getByTestId('order-success')).toBeVisible();
  await expect(page.getByTestId('total')).toHaveText(money(1602));
  await expect(page.getByTestId('cart-count')).toHaveText('0');
});

test('мобильный аккаунт: регистрация, выход и повторный вход', async ({ page }) => {
  const email = await register(page);
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.locator('#nav-login')).toBeVisible();
  await page.getByRole('link', { name: 'Войти', exact: true }).click();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill('Qa-shop-test-2026!');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.locator('#user-name')).toHaveText('Тестовый Покупатель');
});

test('BUG-06: мобильная навигация: пользователь может открыть историю заказов', async ({ page }) => {
  await register(page);
  await expect(page.getByRole('heading', { name: 'Каталог', exact: true })).toBeVisible();
  await expect(page.locator('#nav-orders')).toHaveJSProperty('hidden', false);
  knownBug('BUG-06');
  await expect(page.getByRole('link', { name: 'Мои заказы', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Мои заказы', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Мои заказы', exact: true })).toBeVisible();
});

async function checkWidth(page, testInfo) {
  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth, document: document.documentElement.scrollWidth,
    outside: [...document.querySelectorAll('header *, main *')].filter(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.right > window.innerWidth + 1;
    }).slice(0, 12).map(e => ({ tag: e.tagName, id: e.id, class: e.className, right: e.getBoundingClientRect().right })),
  }));
  await testInfo.attach('layout', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
  expect(geometry.document).toBeLessThanOrEqual(page.viewportSize().width + 1);
}

for (const screen of ['каталог', 'карточка', 'корзина', 'оформление']) {
  test('мобильная вёрстка: ' + screen + ' без горизонтального скролла страницы', async ({ page }, testInfo) => {
    if (screen === 'каталог') {
      await open(page);
      await expect(page.getByTestId('product-card')).toHaveCount(16);
    } else if (screen === 'карточка') {
      await open(page, '/product/1');
      await expect(page.getByTestId('product-page')).toBeVisible();
    } else {
      await add(page, 1);
      if (screen === 'корзина') {
        await cart(page);
        await expect(page.getByTestId('cart-table')).toBeVisible();
      } else {
        await checkout(page);
        await expect(page.getByTestId('shipping')).toHaveText('бесплатно');
      }
    }
    await checkWidth(page, testInfo);
  });
}
test('мобильная шапка: имя пользователя и корзина помещаются после входа', async ({ page }, testInfo) => {
  await register(page);
  await expect(page.getByRole('heading', { name: 'Каталог', exact: true })).toBeVisible();
  await checkWidth(page, testInfo);
  await expect(page.getByTestId('cart-link')).toBeInViewport({ ratio: 1 });
});
