import fs from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

const bundle=fs.readFileSync('extensions/customer-invoices/dist/customer-invoices.js','utf8');
const rows=[
  {id:'test-01',invoice_number:'DEMO-INVOICE-01',invoice_date:'2026-11-18',order_no:'TEST-01',currency:'CAD',total_amount:'126.00',amount_due:'126.00'},
  {id:'test-02',invoice_number:'DEMO-INVOICE-02',invoice_date:'2026-11-18',order_no:'TEST-02',currency:'CAD',total_amount:'52.50',amount_due:'0.00'},
];
for(const [language,fails] of [['en',false],['fr',false],['en',true]]) {
  const dom=new JSDOM('<body></body>',{url:'https://extensions.shopifycdn.com',runScripts:'outside-only',pretendToBeVisual:true});
  let entry;
  const win=dom.window;
  win.shopify={
    extend:(_target,callback)=>{entry=callback;},
    localization:{language:{value:{isoCode:language}}},
    sessionToken:{get:async()=>`test.${Buffer.from(JSON.stringify({dest:'test.myshopify.com'})).toString('base64url')}.test`},
  };
  win.fetch=async(url)=>{
    if(fails) throw new Error('Test network failure');
    const detail=url.includes('/customer/invoices/test-01');
    const payload=detail?{data:{...rows[0],downloadable:true,pdf_path:'/customer/invoices/test-01/pdf?ticket=test',company:{company_name:'TEST COMPANY',street_address1:'123 Example Street',returns_clause:'Example return terms'},sold_to:{name:'Sample Customer',city:'Edmonton',province:'AB',postal:'T5L 4S9'},ship_to:{name:'Receiving'},lines:[{item_number:'TONER-01',description:'Black toner cartridge',qty_ordered:2,qty_shipped:2,qty_backorder:0,unit_price:'50.00',extended_price:'100.00'}],tax_lines:[{code:'GST',amount:'6.00'}],subtotal:'120.00',total_tax:'6.00',less_payment:'0.00'}}
      :{data:rows,meta:{page:1,totalPages:1,total:2,summary:{total_invoices:2,paid:1,pending:1}}};
    return {ok:true,headers:{get:()=> 'application/json'},json:async()=>payload};
  };
  win.eval(bundle);
  assert.equal(typeof entry,'function');
  await entry();
  await new Promise(resolve=>setTimeout(resolve,80));
  assert.ok(win.document.querySelector('s-page'));
  assert.ok(win.document.querySelector('s-grid'),'Invoice columns should render even on a connection error');
  if(fails) {
    assert.ok(win.document.querySelector('s-banner'),'Connection failure must be visible');
  } else {
    assert.match(win.document.body.textContent,/DEMO-INVOICE-01/);
    assert.match(win.document.body.textContent,/DEMO-INVOICE-02/);
    assert.match(win.document.body.textContent,/126/);
    assert.equal(win.document.querySelector('s-spinner'),null);
    assert.equal(win.document.querySelectorAll('s-badge').length,2);
    const button=[...win.document.querySelectorAll('s-button')].find(element=>element.textContent===(language==='fr'?'Aper\u00e7u':'Preview'));
    assert.ok(button,'Preview action must be available');
    button.dispatchEvent(new win.Event('click',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,80));
    assert.match(win.document.body.textContent,/TEST COMPANY/);
    assert.match(win.document.body.textContent,/Black toner cartridge/);
    assert.match(win.document.body.textContent,/Edmonton, AB, T5L 4S9/);
    assert.ok(win.document.querySelector('s-button[href*="/pdf?ticket=test"]'),'Preview must offer a PDF download');
    assert.match(win.document.body.textContent,/Example return terms/);
  }
  dom.window.close();
}
console.log('Built extension passed: English/French invoice rows, status badges, preview navigation, addresses, line items, PDF action, and visible connection errors.');
