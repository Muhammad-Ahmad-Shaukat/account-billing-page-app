import fs from 'node:fs';
import {finished} from 'node:stream/promises';
import {streamInvoicePdf} from '../services/invoice-pdf.js';

const company={company_name:'INK QUEST',street_address1:'14617 134 Ave NW',street_address2:'Edmonton, AB T5L 4S9',telephone:'(780) 454-4321',fax:'(780) 452-5405',tax_registration_no:'123456789RT0001',returns_clause:'No returns without our written permission (RMA).',overdue_clause:'2% per month (24% annual) will be charged on overdue accounts.',claims_clause:'All claims must be made within 5 days after receipt of goods.',surcharge_clause:'A 3% charge may apply for any credit card bill payment.'};
const invoice={invoice_number:'IQ-2026-00142',revision:2,invoice_date:'2026-11-18',order_no:'SO-46001',po_number:'PO-80001',customer_no:'C-10042',terms:'Net 30 days',ship_via:'CANPAR',salesperson:'JD',currency:'CAD',company,
sold_to:{name:'Sample Print Studio',address1:'100 Sample Street',city:'Edmonton',province:'AB',postal:'T5L 4S9',country:'Canada'},
ship_to:{name:'Receiving Department',address1:'200 Example Avenue',city:'Calgary',province:'AB',postal:'T2P 1J9',country:'Canada'},
lines:[
{item_number:'TN-221-BK',description:'Compatible black toner cartridge - high yield',qty_ordered:2,qty_shipped:2,qty_backorder:0,unit_price:'50.00',uom:'EACH',extended_price:'100.00'},
{item_number:'LC401XL-C',description:'Cyan ink cartridge / Cartouche cyan haute capacite',qty_ordered:3,qty_shipped:2,qty_backorder:1,unit_price:'12.50',uom:'EACH',extended_price:'25.00'},
{item_number:'FREIGHT',description:'Shipping and handling - ground delivery',qty_ordered:null,qty_shipped:null,qty_backorder:null,unit_price:null,uom:null,extended_price:'18.50'}],
tax_lines:[{code:'GST',amount:'7.18'},{code:'PST',amount:'0.00'}],subtotal:'143.50',total_tax:'7.18',total_amount:'150.68',less_payment:'50.00',amount_due:'100.68'};
fs.mkdirSync('output/pdf',{recursive:true});
fs.mkdirSync('tmp/pdfs',{recursive:true});
for(const [file,language,data] of [
['output/pdf/invoice-design-en.pdf','en',invoice],
['output/pdf/invoice-design-fr.pdf','fr',invoice],
['tmp/pdfs/invoice-multipage.pdf','fr',{...invoice,lines:Array.from({length:65},(_,index)=>({...invoice.lines[index%3],item_number:`ITEM-${index+1}`,description:`${index+1}. ${invoice.lines[index%3].description} - additional product information for wrapping and page-break verification.`}))}],
['tmp/pdfs/invoice-long-description.pdf','en',{...invoice,lines:[{...invoice.lines[0],description:'Long product description for page continuation. '.repeat(190)}]}],
]) {
 const output=fs.createWriteStream(file);output.set=()=>output;
 const done=finished(output);
 streamInvoicePdf(output,data,language);
 await done;
 console.log(`Generated ${file}`);
}
