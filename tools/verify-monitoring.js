const fs = require('node:fs');
const { chromium, expect } = require('@playwright/test');
const dashboard = require('../monitoring/dashboards/qa-shop.json');
async function main() {
  fs.mkdirSync('evidence', { recursive: true });
  const result = { checkedAt: new Date().toISOString(), queries: [] };
  for (const panel of dashboard.panels) {
    const expr = panel.targets[0].expr.replaceAll('$__rate_interval', '1m').replaceAll('$__range', '1h');
    const res = await fetch('http://127.0.0.1:19090/api/v1/query?query=' + encodeURIComponent(expr));
    const body = await res.json();
    if (!res.ok || body.status !== 'success') throw Error(panel.title + ': invalid PromQL');
    result.queries.push({ title: panel.title, expression: expr, series: body.data.result.length });
  }
  const target = await (await fetch('http://127.0.0.1:19090/api/v1/targets')).json();
  result.target = target.data.activeTargets.map(t => ({ health: t.health, lastError: t.lastError, scrapeUrl: t.scrapeUrl }));
  if (!result.target.every(t => t.health === 'up')) throw Error('Prometheus target down');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const shop = process.env.SHOP_URL || 'https://ccd-bracelet-baghdad-bedrooms.trycloudflare.com';
    const grafana = process.env.GRAFANA_URL || 'https://orbit-build-opportunity-alexandria.trycloudflare.com';
    const shopResponse = await page.goto(shop);
    await expect(page.getByTestId('product-card')).toHaveCount(16);
    await page.screenshot({ path: 'evidence/shop.png', fullPage: true });
    result.shop = { url: shop, status: shopResponse.status(), products: 16 };
    const firstQuery = page.waitForResponse(r => r.url().includes('/api/ds/query') && r.status() === 200, { timeout: 30000 });
    const response = await page.goto(grafana + '/d/qa-shop', { timeout: 60000 });
    await firstQuery;
    await expect(page.getByText('1', { exact: true }).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Магазин доступен (1 = да)', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Время работы Node.js', { exact: true })).toBeVisible();
    await expect.poll(async () => (await page.locator('body').innerText()).includes('Loading dashboard'), { timeout: 30000 }).toBe(false);
    await page.screenshot({ path: 'evidence/grafana.png', fullPage: true });
    const dashboardResponse = await page.request.get(grafana + '/api/dashboards/uid/qa-shop');
    const data = await dashboardResponse.json();
    if (data.dashboard.panels.length !== 20) throw Error('Wrong panel count');
    result.grafana = { url: grafana + '/d/qa-shop', status: response.status(), anonymousDashboardStatus: dashboardResponse.status(), panels: 20, browserErrors: errors };
    if (errors.length) throw Error('Browser errors: ' + errors.join('; '));
    fs.writeFileSync('evidence/monitoring-verification.json', JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
