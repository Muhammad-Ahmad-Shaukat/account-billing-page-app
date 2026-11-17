import '../load-env.js';
import assert from 'node:assert/strict';
import express from 'express';
import { documentTicket } from '../services/document-ticket.js';
import { pool } from '../db.js';
import { createHmac } from 'node:crypto';
import { SignJWT } from 'jose';
import { runtimeConfig } from '../runtime-config.js';

// Test-only secret if CLI credentials are absent; no Shopify API calls are made.
process.env.SHOPIFY_API_SECRET ||= 'download-route-test-secret';
const { default: router } = await import('../routes/customer-invoices-proxy.js');
const app = express();
app.use('/api/customer-account', router);
app.use('/api/proxy/account', router);
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/customer-account/customer/invoices`;
const id = '7d9cf436-996e-4c9e-aadb-33c23a8741ac';
try {
  const ticket = documentTicket('download-route-test.myshopify.com', '0', id);
  const response = await fetch(`${base}/${id}/pdf?ticket=${ticket}`);
  // A valid UUID capability must reach the ownership lookup; it must not require a bearer header.
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'Invoice not found');
  assert.equal((await fetch(`${base}/${id}/pdf?ticket=invalid`)).status, 401);
  assert.equal((await fetch(base)).status, 401);
  const proxyBase = `http://127.0.0.1:${server.address().port}/api/proxy/account/customer/invoices`;
  const shop = 'download-route-test.myshopify.com';
  function proxyQuery(signedShop = shop) {
    const values = { shop: signedShop, timestamp: String(Math.floor(Date.now() / 1000)), logged_in_customer_id: '' };
    const signed = Object.keys(values).sort().map(key => `${key}=${values[key]}`).join('');
    return new URLSearchParams({ ...values, signature: createHmac('sha256', process.env.SHOPIFY_API_SECRET).update(signed).digest('hex') });
  }
  const bearer = await new SignJWT({dest: shop, sub: 'gid://shopify/Customer/0'})
    .setProtectedHeader({alg: 'HS256'}).setAudience(runtimeConfig.apiKey).setIssuedAt().setExpirationTime('5m')
    .sign(Buffer.from(process.env.SHOPIFY_API_SECRET));
  const proxyList = await fetch(`${proxyBase}?${proxyQuery()}`, {headers: {Authorization: `Bearer ${bearer}`}});
  assert.equal(proxyList.status, 200);
  assert.deepEqual((await proxyList.json()).data, []);
  assert.equal((await fetch(`${proxyBase}?${proxyQuery()}`)).status, 401);
  assert.equal((await fetch(`${proxyBase}?shop=${shop}&signature=invalid`, {headers: {Authorization: `Bearer ${bearer}`}})).status, 401);
  assert.equal((await fetch(`${proxyBase}?${proxyQuery('different-shop.myshopify.com')}`, {headers: {Authorization: `Bearer ${bearer}`}})).status, 401);
  // Proxy signatures include the download ticket as a signed query field.
  function downloadQuery(ticket, signedShop = shop) {
    const values = {shop: signedShop, timestamp: String(Math.floor(Date.now()/1000)), ticket};
    const signed = Object.keys(values).sort().map(key => `${key}=${values[key]}`).join('');
    return new URLSearchParams({...values, signature: createHmac('sha256',process.env.SHOPIFY_API_SECRET).update(signed).digest('hex')});
  }
  assert.equal((await fetch(`${proxyBase}/${id}/pdf?${downloadQuery(ticket)}`)).status, 404);
  assert.equal((await fetch(`${proxyBase}/${id}/pdf?${downloadQuery(ticket,'different-shop.myshopify.com')}`)).status, 401);
  assert.equal((await fetch(proxyBase, {method:'OPTIONS'})).status, 204);
  console.log('Download route passed: UUID ticket routing, ownership lookup, tamper rejection, and list authentication.');
  console.log('App proxy passed: signed proxy + customer token, no storefront cookie, cross-shop rejection, PDF capabilities and preflight.');
} finally {
  await new Promise(resolve => server.close(resolve));
  await pool.end();
}
