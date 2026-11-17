import assert from 'node:assert/strict';
import { getRuntimeConfig } from '../runtime-config.js';

const configured = getRuntimeConfig({ SHOPIFY_APP_URL: 'https://invoices.example.com/', SHOPIFY_API_KEY: 'test-client', SCOPES: 'read_customers', INVOICE_SHOP_DOMAIN: 'https://shop.myshopify.com/' });
assert.equal(configured.appUrl, 'https://invoices.example.com');
assert.equal(configured.apiKey, 'test-client');
assert.equal(configured.shop, 'shop.myshopify.com');
assert.equal(getRuntimeConfig({ HOST: 'https://tunnel.example.com', SHOPIFY_APP_URL: 'https://production.example.com' }).appUrl, 'https://tunnel.example.com');
assert.ok(getRuntimeConfig({}).apiKey);
assert.throws(() => getRuntimeConfig({ SHOPIFY_APP_URL: 'https://user:secret@example.com' }));
assert.throws(() => getRuntimeConfig({ SHOPIFY_APP_URL: 'https://example.com/api' }));
console.log('Runtime configuration checks passed: environment overrides, CLI tunnel precedence, app defaults, and URL validation.');
