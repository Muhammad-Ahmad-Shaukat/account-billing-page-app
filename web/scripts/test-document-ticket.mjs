import assert from 'node:assert/strict';
import { documentTicket, verifyDocumentTicket } from '../services/document-ticket.js';

process.env.SHOPIFY_API_SECRET = 'test-only-secret';
function verify(ticket, id = '12') {
  let status, passed = false;
  const req = { query: { ticket }, path: `/customer/invoices/${id}/pdf` };
  const res = { set() { return this; }, status(code) { status = code; return this; }, json() {} };
  verifyDocumentTicket(req, res, () => { passed = true; });
  return { status, passed, req };
}
const ticket = documentTicket('test.myshopify.com', '42', '12');
const uuid = '7d9cf436-996e-4c9e-aadb-33c23a8741ac';
assert.equal(verify(documentTicket('test.myshopify.com', '42', uuid), uuid).passed, true);
const valid = verify(ticket);
assert.equal(valid.passed, true);
assert.equal(valid.req.loggedInCustomerId, '42');
assert.equal(valid.req.proxyShop, 'test.myshopify.com');
assert.equal(verify(ticket, '13').status, 401);
assert.equal(verify(ticket + 'x').status, 401);
assert.equal(verify('').status, 401);
const now = Date.now;
Date.now = () => now() + 301000;
assert.equal(verify(ticket).status, 401);
Date.now = now;
console.log('Document ticket checks passed: ownership scope, tampering, missing and expired links.');
