const { test: base, expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { add, checkout, register } = require('./helpers');

// A real, separate app process with a controlled last-unit fixture. No mocks,
// public reset endpoint or changes to the provided application are required.
const test = base.extend({
  inventoryShop: async ({}, use, testInfo) => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise((resolve, reject) => probe.close(e => e ? reject(e) : resolve()));
    const dataDir = testInfo.outputPath('inventory-db');
    fs.mkdirSync(dataDir, { recursive: true });
    const products = JSON.parse(JSON.stringify(require('../products.json')));
    products.find(p => p.id === 11).stock = 1;
    fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({ products, users: [], orders: [], nextUserId: 1, nextOrderId: 1001 }));
    const app = spawn(process.execPath, ['server.js'], {
      cwd: path.resolve(__dirname, '..'), windowsHide: true,
      env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, ALLOW_TEST_RESET: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let logs = '';
    app.stdout.on('data', b => { logs += b; });
    app.stderr.on('data', b => { logs += b; });
    const url = 'http://127.0.0.1:' + port;
    try {
      await expect.poll(async () => {
        try { return (await fetch(url + '/api/health')).status; } catch { return 0; }
      }, { timeout: 10000, message: 'Isolated inventory app starts' }).toBe(200);
      await use({ url, dataDir });
    } finally {
      if (app.exitCode === null) {
        const stopped = once(app, 'exit');
        app.kill();
        await stopped;
      }
      await testInfo.attach('inventory-server-log', { body: logs, contentType: 'text/plain' });
    }
  },
});
test.skip(!!process.env.BASE_URL, 'Last-unit test uses a separate local database, never the public shop');

test('два покупателя: последняя единица продаётся ровно один раз', async ({ browser, inventoryShop }, testInfo) => {
  test.setTimeout(45000);
  const contexts = await Promise.all([browser.newContext({ baseURL: inventoryShop.url }), browser.newContext({ baseURL: inventoryShop.url })]);
  try {
    const pages = await Promise.all(contexts.map(c => c.newPage()));
    for (const page of pages) {
      await register(page);
      await add(page, 11);
      await checkout(page);
    }
    let arrived = 0, release;
    const bothReady = new Promise(resolve => { release = resolve; });
    for (const context of contexts) {
      await context.route('**/api/orders', async route => {
        if (route.request().method() === 'POST') {
          if (++arrived === 2) release();
          await bothReady;
        }
        await route.continue();
      });
    }
    const responses = pages.map(page => page.waitForResponse(r => r.url().endsWith('/api/orders') && r.request().method() === 'POST'));
    await Promise.all(pages.map(page => page.getByRole('button', { name: 'Подтвердить заказ', exact: true }).click()));
    const statuses = (await Promise.all(responses)).map(r => r.status());
    expect([...statuses].sort()).toEqual([201, 409]);
    const winner = statuses.indexOf(201), loser = statuses.indexOf(409);
    await expect(pages[winner].getByTestId('order-success')).toBeVisible();
    await expect(pages[loser].getByRole('alert')).toContainText('осталось 0 шт.');
    const stock = await (await pages[loser].request.get('/api/products/11')).json();
    expect(stock.stock).toBe(0);
    const losingCart = await (await pages[loser].request.get('/api/cart')).json();
    expect(losingCart.count).toBe(1);
    const winningCart = await (await pages[winner].request.get('/api/cart')).json();
    expect(winningCart.count).toBe(0);
    const db = JSON.parse(fs.readFileSync(path.join(inventoryShop.dataDir, 'db.json'), 'utf8'));
    expect(db.orders).toHaveLength(1);
    expect(db.orders[0].items).toEqual([expect.objectContaining({ productId: 11, qty: 1 })]);
    await testInfo.attach('last-unit-result', { body: JSON.stringify({ statuses, remainingStock: stock.stock, savedOrders: db.orders.length }), contentType: 'application/json' });
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
