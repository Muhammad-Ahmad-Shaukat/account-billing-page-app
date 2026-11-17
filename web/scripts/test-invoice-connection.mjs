import assert from 'node:assert/strict';
import {connectionCandidates, fetchInvoices} from '../../extensions/customer-invoices/src/invoice-api.js';
const token = `test.${Buffer.from(JSON.stringify({dest:'https://test-shop.myshopify.com'})).toString('base64url')}.test`;
const candidates = connectionCandidates(token);
assert.equal(candidates[0], 'https://test-shop.myshopify.com/apps/account-billing/account');
assert.throws(() => connectionCandidates(`test.${Buffer.from(JSON.stringify({dest:'evil.example'})).toString('base64url')}.test`));
const original = globalThis.fetch;
const calls = [];
try {
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.credentials, 'omit');
    return new Response(JSON.stringify({data: []}), {headers: {'content-type':'application/json'}});
  };
  assert.equal((await fetchInvoices('?page=1',token)).apiBase,candidates[0]);
  assert.equal(calls.length,1);
  if (candidates.length > 1) {
    calls.length = 0;
    globalThis.fetch = async url => {
      calls.push(url);
      return url.startsWith(candidates[0])
        ? new Response('<html>Store password</html>', {headers:{'content-type':'text/html'}})
        : new Response(JSON.stringify({data:[]}), {headers:{'content-type':'application/json'}});
    };
    assert.equal((await fetchInvoices('',token)).apiBase,candidates[1]);
    assert.equal(calls.length,2);
  }
  console.log('Invoice connection passed: stable proxy address, token header, destination checks, and password-page fallback.');
} finally { globalThis.fetch = original; }
