import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { streamInvoicePdf } from '../services/invoice-pdf.js';

for (const lang of ['en', 'fr']) {
  const chunks = [];
  const res = new Writable({ write(chunk, encoding, done) { chunks.push(chunk); done(); } });
  res.set = () => res;
  const finished = new Promise((resolve, reject) => { res.on('finish', resolve); res.on('error', reject); });
  streamInvoicePdf(res, {
    invoice_number: 'TEST', currency: 'CAD', company: { company_name: 'Test' },
    lines: Array.from({length: 80}, () => ({ description: 'Produit français', qty_shipped: 2, unit_price: '5', extended_price: '10' })),
    tax_lines: [], total_amount: '800', amount_due: '800',
  }, lang);
  await finished;
  const pdf = Buffer.concat(chunks);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok((pdf.toString().match(/\/Type \/Page\b/g) || []).length > 1);
  console.log(`${lang}: multi-page PDF generated (${pdf.length} bytes)`);
}
