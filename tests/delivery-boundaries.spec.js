const { test, expect } = require('@playwright/test');
const { add, cart, promo, money } = require('./helpers');

const baskets = [
  { label: '2990: ниже порога', items: [[2, 1], [9, 1], [12, 1]], subtotal: 2990, discount: 0, shipping: 300 },
  { label: '3000: ровно на пороге', items: [[4, 1], [9, 1], [10, 1], [13, 1]], subtotal: 3000, discount: 0, shipping: 0 },
  { label: '3010: выше порога', items: [[2, 1], [9, 1], [14, 1]], subtotal: 3010, discount: 0, shipping: 0 },
  { label: 'WELCOME500: 3500 минус 500 равно 3000', items: [[6, 2]], subtotal: 3500, code: 'WELCOME500', discount: 500, shipping: 0 },
  { label: 'SALE10: 3330 минус 333 равно 2997', items: [[2, 1], [9, 1], [13, 1], [14, 1]], subtotal: 3330, code: 'SALE10', discount: 333, shipping: 300 },
  { label: 'SALE10: 3340 минус 334 равно 3006', items: [[6, 1], [10, 1]], subtotal: 3340, code: 'SALE10', discount: 334, shipping: 0 },
];
for (const basket of baskets) {
  test('доставка — ' + basket.label, async ({ page }) => {
    for (const [id, qty] of basket.items) await add(page, id, qty);
    await cart(page);
    await expect(page.getByTestId('subtotal')).toHaveText(money(basket.subtotal));
    if (basket.code) {
      await promo(page, basket.code);
      await expect(page.getByTestId('discount')).toHaveText('−' + money(basket.discount));
    }
    await page.getByRole('link', { name: 'Оформить заказ', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Оформление заказа', exact: true })).toBeVisible();
    await expect(page.getByTestId('shipping')).toHaveText(basket.shipping ? money(basket.shipping) : 'бесплатно');
    await expect(page.getByTestId('total')).toHaveText(money(basket.subtotal - basket.discount + basket.shipping));
    await page.getByLabel('Самовывоз', { exact: true }).check();
    await expect(page.getByTestId('shipping')).toHaveText('бесплатно');
    await expect(page.getByTestId('total')).toHaveText(money(basket.subtotal - basket.discount));
  });
}
