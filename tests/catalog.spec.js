const { test, expect } = require('@playwright/test');
const { open, money } = require('./helpers');
const products = require('../products.json');

test('каталог: 16 товаров, карточка, цена и описание', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('product-card')).toHaveCount(16);
  await page.getByRole('link', { name: products[0].name, exact: true }).click();
  await expect(page.getByRole('heading', { name: products[0].name, exact: true })).toBeVisible();
  await expect(page.getByTestId('product-price')).toHaveText(money(890));
  await expect(page.getByText(products[0].description, { exact: true })).toBeVisible();
});
for (const query of ['  иРгАчЕфФ  ', 'бергамота']) {
  test(`поиск по названию/описанию: ${query}`, async ({ page }) => {
    await open(page);
    await page.getByRole('searchbox', { name: 'Поиск', exact: true }).fill(query);
    await expect(page.getByTestId('product-card')).toHaveCount(1);
    await expect(page.getByTestId('product-card')).toContainText(products[0].name);
  });
}
test('пустая выдача и восстановление каталога', async ({ page }) => {
  await open(page);
  await page.getByRole('searchbox').fill('несуществующий-товар-987654');
  await expect(page.getByTestId('empty-list')).toBeVisible();
  await page.getByRole('searchbox').fill('');
  await expect(page.getByTestId('product-card')).toHaveCount(16);
});
test('категория и поиск работают совместно', async ({ page }) => {
  await open(page);
  await page.getByLabel('Категория', { exact: true }).selectOption('tea');
  await expect(page.getByTestId('product-card')).toHaveCount(3);
  await page.getByRole('searchbox').fill('Ассам');
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  await expect(page.getByTestId('product-card')).toContainText('Чай Ассам');
});
for (const sort of ['price_asc', 'price_desc', 'name']) {
  test(`сортировка ${sort}`, async ({ page }) => {
    await open(page);
    const response = page.waitForResponse(r => r.url().includes('sort=' + sort));
    await page.getByLabel('Сортировка').selectOption(sort);
    await response;
    const sorted = [...products].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'ru') : sort === 'price_asc' ? a.price - b.price : b.price - a.price);
    await expect(page.locator('.card__name')).toHaveText(sorted.map(p => p.name));
  });
}
test('нет в наличии: добавление недоступно в каталоге и карточке', async ({ page }) => {
  await open(page);
  const card = page.getByTestId('product-card').filter({ hasText: products[2].name });
  await expect(card.getByRole('button')).toBeDisabled();
  await card.getByRole('link', { name: products[2].name, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Добавить в корзину', exact: true })).toBeDisabled();
});
