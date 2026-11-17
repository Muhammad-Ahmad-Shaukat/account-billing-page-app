import '../load-env.js';
import {SignJWT} from 'jose';
import assert from 'node:assert/strict';

// App-side diagnostic token only; this does not create a Shopify login session.
const token = await new SignJWT({dest:process.env.INVOICE_SHOP_DOMAIN,sub:'gid://shopify/Customer/31409066082435'})
  .setProtectedHeader({alg:'HS256'}).setAudience(process.env.SHOPIFY_API_KEY).setIssuedAt().setExpirationTime('2m')
  .sign(Buffer.from(process.env.SHOPIFY_API_SECRET));
const headers={Authorization:`Bearer ${token}`};
const origin=new URL(process.env.SHOPIFY_APP_URL);
const listUrl=new URL('/api/customer-account/customer/invoices',origin);
const list=await fetch(listUrl,{headers,signal:AbortSignal.timeout(45000)});
console.log(`Live customer API: HTTP ${list.status}; CORS=${list.headers.get('access-control-allow-origin')}`);
if(!list.ok) {
  const result=await list.json().catch(()=>({}));
  console.log('API error:',result.error || 'Unexpected response');
  process.exit(1);
}
const payload=await list.json();
const invoices=payload.data.filter(row=>row.invoice_number.startsWith('DEMO-31409066082435-20261118-'));
assert.equal(invoices.length,2);
for(const invoice of invoices) {
  const detail=await fetch(new URL(`/api/customer-account/customer/invoices/${invoice.id}`,origin),{headers,signal:AbortSignal.timeout(45000)});
  assert.equal(detail.status,200);
  const data=(await detail.json()).data;
  assert.ok(data.lines.length);
  assert.ok(data.pdf_path);
  const pdfPath=data.pdf_path.startsWith('/api/')?data.pdf_path:`/api/customer-account${data.pdf_path}`;
  const pdf=await fetch(new URL(pdfPath,origin),{signal:AbortSignal.timeout(45000)});
  assert.equal(pdf.status,200);
  assert.ok(pdf.headers.get('content-type')?.includes('application/pdf'));
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
  console.log(`Verified list, preview and PDF: ${invoice.invoice_number}`);
}
const proxy=await fetch(`https://${process.env.INVOICE_SHOP_DOMAIN}/apps/account-billing/account/customer/invoices`,{headers,signal:AbortSignal.timeout(20000)});
console.log(`Live storefront proxy: HTTP ${proxy.status}; content type=${proxy.headers.get('content-type')}; CORS=${proxy.headers.get('access-control-allow-origin')}`);
