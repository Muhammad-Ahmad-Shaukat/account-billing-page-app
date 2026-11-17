import '../load-env.js';

const customer = '31409066082435';
const base = new URL(process.env.SHOPIFY_APP_URL);
if (base.protocol !== 'https:' || base.username || base.password || /REPLACE/i.test(base.hostname)) throw new Error('Configure the live SHOPIFY_APP_URL first');
const headers = {
  'Content-Type': 'application/json',
  'X-Invoice-Secret': process.env.INVOICE_INGEST_SECRET,
  'X-Shopify-Shop-Domain': process.env.INVOICE_SHOP_DOMAIN,
};
if (!headers['X-Invoice-Secret'] || !headers['X-Shopify-Shop-Domain']) throw new Error('Missing ingest configuration');
const common = {
  shopify_customer_id: customer,
  invoice_date: '2026-11-18', order_date: '2026-11-18', revision: 1,
  customer_no: `TEST-${customer}`, currency: 'CAD', terms: 'Test invoice - no payment requested',
  sold_to: {name: 'Test invoice for account preview'},
  ship_to: {name: 'Test invoice - no shipment'},
};
const invoices = [
  {...common, invoice_number: `DEMO-${customer}-20261118-01`, order_no:'TEST-ORDER-01', po_number:'TEST-PO-01',
    lines: [
      {item_number:'DEMO-TONER',description:'TEST - Black toner cartridge',qty_ordered:2,qty_shipped:2,qty_backorder:0,unit_price:'50.00',uom:'EACH',extended_price:'100.00'},
      {item_number:'DEMO-PAPER',description:'TEST - Printer paper',qty_ordered:1,qty_shipped:1,qty_backorder:0,unit_price:'20.00',uom:'PACK',extended_price:'20.00'},
    ], tax_lines:[{code:'GST',amount:'6.00'}], subtotal:'120.00',total_tax:'6.00',total_amount:'126.00',less_payment:'0.00',amount_due:'126.00'},
  {...common, invoice_number: `DEMO-${customer}-20261118-02`, order_no:'TEST-ORDER-02',po_number:'TEST-PO-02',
    lines:[{item_number:'DEMO-INK',description:'TEST - Colour ink cartridge pack',qty_ordered:1,qty_shipped:1,qty_backorder:0,unit_price:'50.00',uom:'PACK',extended_price:'50.00'}],
    tax_lines:[{code:'GST',amount:'2.50'}],subtotal:'50.00',total_tax:'2.50',total_amount:'52.50',less_payment:'52.50',amount_due:'0.00'},
];
for (const invoice of invoices) {
  const existsUrl = new URL('/api/invoices/exists',base);
  existsUrl.search = new URLSearchParams({shopify_customer_id:customer,invoice_number:invoice.invoice_number});
  const before = await fetch(existsUrl,{headers,signal:AbortSignal.timeout(45000)});
  if (!before.ok) throw new Error(`Live ingest authentication/check failed: HTTP ${before.status}`);
  const prior = await before.json();
  if (!prior.data?.exists) {
    const response = await fetch(new URL('/api/invoices/ingest',base),{method:'POST',headers,body:JSON.stringify(invoice),signal:AbortSignal.timeout(45000)});
    if (!response.ok) throw new Error(`Invoice creation failed: HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success || !result.data?.downloadable) throw new Error('Invoice was not stored as downloadable');
  }
  const check = await fetch(existsUrl,{headers,signal:AbortSignal.timeout(45000)});
  const stored = await check.json();
  if (!check.ok || !stored.data?.exists || !stored.data?.downloadable) throw new Error('Live persistence verification failed');
  console.log(`Verified ${invoice.invoice_number}: CAD ${invoice.total_amount}, ${invoice.amount_due === '0.00' ? 'paid' : 'due'}, downloadable PDF available.`);
}
