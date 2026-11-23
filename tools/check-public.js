// Public connectivity check intended to run from GitHub's hosted runner.
const assert = require('node:assert/strict');
async function main() {
  const shop = process.env.SHOP_URL;
  const grafana = process.env.GRAFANA_URL;
  assert.ok(shop && grafana, 'Set SHOP_URL and GRAFANA_URL');
  const get = async url => {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    assert.equal(res.status, 200, url);
    return res;
  };
  const health = await (await get(shop + '/api/health')).json();
  assert.equal(health.app, 'qa-shop');
  assert.equal(health.status, 'ok');
  const html = await (await get(shop + '/')).text();
  assert.ok(html.includes('name="application" content="qa-shop"'));
  const metrics = await (await get(shop + '/metrics')).text();
  assert.ok(metrics.includes('http_requests_total'));
  const status = await (await get(grafana + '/api/health')).json();
  assert.equal(status.database, 'ok');
  const dashboard = await (await get(grafana + '/api/dashboards/uid/qa-shop')).json();
  assert.equal(dashboard.dashboard.panels.length, 20);
  console.log('PASS: public shop, metrics and anonymous Grafana dashboard are reachable; no VPN or authentication used.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
