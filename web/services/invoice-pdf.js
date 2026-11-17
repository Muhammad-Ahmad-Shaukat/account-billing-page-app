import PDFDocument from 'pdfkit';
import {readFileSync} from 'node:fs';
import {addressLines} from '../../extensions/customer-invoices/src/invoice-format.js';
const en=JSON.parse(readFileSync(new URL('../../extensions/customer-invoices/locales/en.default.json',import.meta.url)));
const fr=JSON.parse(readFileSync(new URL('../../extensions/customer-invoices/locales/fr.json',import.meta.url)));
const color={ink:'#142638',muted:'#607184',line:'#DCE3EA',soft:'#F2F5F8',white:'#FFFFFF',accent:'#207A75'};
const M=42,W=511,BOTTOM=756;
const clean=value=>String(value ?? '-').replace(/[\u00a0\u202f]/g,' ').replace(/[\u2011\u2013\u2014]/g,'-');

export function streamInvoicePdf(res,invoice,language) {
  const t=language==='fr'?fr:en;
  const locale=language==='fr'?'fr-CA':'en-CA';
  const company=invoice.company || {};
  const currency=invoice.currency || 'CAD';
  const money=value=>value==null || value===''?'-':clean(new Intl.NumberFormat(locale,{style:'currency',currency}).format(Number(value)));
  const date=value=>!value || !Number.isFinite(new Date(value).getTime())?'-':clean(new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value)));
  const doc=new PDFDocument({size:'A4',margin:M,bufferPages:true,info:{Title:`${t.invoice} ${invoice.invoice_number}`,Author:company.company_name || '',Subject:t.documentCopy}});
  const filename=String(invoice.invoice_number).replace(/[^a-zA-Z0-9_-]/g,'_');
  res.set('Content-Type','application/pdf');
  res.set('Content-Disposition',`attachment; filename="invoice-${filename}.pdf"`);
  doc.on('error',()=>res.destroy());
  doc.pipe(res);
  let y=M;
  const text=(value,x,top,width,{size=9,bold=false,fill=color.ink,align='left',...options}={})=>{
    doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(size).fillColor(fill).text(clean(value),x,top,{width,align,lineGap:2,...options});
  };
  const height=(value,width,size=9,bold=false)=>{
    doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(size);
    return doc.heightOfString(clean(value),{width,lineGap:2});
  };
  const rule=(top)=>doc.moveTo(M,top).lineTo(M+W,top).lineWidth(0.6).strokeColor(color.line).stroke();
  function newPage() {
    doc.addPage();
    text(company.company_name || '',M,34,240,{size:10,bold:true});
    text(`${t.invoice} ${invoice.invoice_number} | ${t.continued}`,M+250,34,W-250,{size:8,fill:color.muted,align:'right'});
    rule(59); y=77;
  }
  function ensure(required) { if(y+required>BOTTOM) newPage(); }
  function wrap(value,width,size=9,bold=false) {
    doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(size);
    const lines=[];
    for(const paragraph of clean(value).split(/\r?\n/)) {
      let line='';
      for(const word of paragraph.split(/\s+/)) {
        if(doc.widthOfString([line,word].filter(Boolean).join(' '))<=width) line=[line,word].filter(Boolean).join(' ');
        else {
          if(line) lines.push(line);
          line='';
          for(const char of word) {
            if(doc.widthOfString(line+char)>width && line){lines.push(line);line='';}
            line+=char;
          }
        }
      }
      lines.push(line);
    }
    return lines.length?lines:['-'];
  }
  // Company wordmark and document identity.
  doc.rect(M,29,W,4).fill(color.ink);
  const companyHeight=height(company.company_name || '',270,22,true);
  text(company.company_name || '',M,48,270,{size:22,bold:true});
  let leftY=48+companyHeight+10;
  for(const value of [company.street_address1,company.street_address2,[company.telephone,company.fax?`${t.fax}: ${company.fax}`:null].filter(Boolean).join(' | ')].filter(Boolean)) {
    text(value,M,leftY,270,{fill:color.muted}); leftY+=height(value,270)+3;
  }
  const registration=company.tax_registration_no || invoice.tax_registration_no;
  if(registration){text(`${t.taxRegistration}: ${registration}`,M,leftY,270,{size:8,fill:color.muted});leftY+=height(`${t.taxRegistration}: ${registration}`,270,8)+4;}
  text(t.invoice.toUpperCase(),M+292,49,W-292,{size:10,bold:true,fill:color.accent,align:'right'});
  const numberHeight=height(invoice.invoice_number,W-292,16,true);
  text(invoice.invoice_number,M+292,69,W-292,{size:16,bold:true,align:'right'});
  const known=invoice.amount_due!=null && invoice.amount_due!=='';
  const paid=known && Number(invoice.amount_due)<=0;
  text(`${known?(paid?t.paid:t.unpaid):t.unknown}  |  ${currency}`,M+292,78+numberHeight,W-292,{size:9,bold:true,fill:paid?color.accent:color.muted,align:'right'});
  y=Math.max(leftY+12,111+numberHeight);
  // Four metadata fields on each row, each measured to avoid truncation.
  const fields=[[t.date,date(invoice.invoice_date)],[t.order,invoice.order_no],[t.po,invoice.po_number],[t.customerNumber,invoice.customer_no],
    [t.terms,invoice.terms],[t.shipVia,invoice.ship_via],[t.salesperson,invoice.salesperson],[t.revision,invoice.revision ?? 1]];
  for(let row=0;row<2;row++) {
    const values=fields.slice(row*4,row*4+4),cw=W/4;
    const rowHeight=Math.max(...values.map(([label,value])=>height(label,cw-18,7.3)+height(value || '-',cw-18,9,true)+18));
    ensure(rowHeight);
    doc.rect(M,y,W,rowHeight).fill(color.soft);
    for(let index=0;index<values.length;index++) {
      const [label,value]=values[index],x=M+index*cw+10;
      text(label,x,y+9,cw-18,{size:7.3,fill:color.muted});
      text(value || '-',x,y+12+height(label,cw-18,7.3),cw-18,{size:9,bold:true});
    }
    y+=rowHeight;
  }
  y+=18;
  const addressWidth=(W-28)/2;
  const addresses=[[t.soldTo,addressLines(invoice.sold_to)],[t.shipTo,addressLines(invoice.ship_to)]];
  const addressHeight=Math.max(...addresses.map(([,lines])=>lines.reduce((sum,line,index)=>sum+height(line,addressWidth-24,9,index===0)+3,0)))+38;
  ensure(addressHeight);
  addresses.forEach(([label,lines],index)=>{
    const x=M+index*(addressWidth+28);
    doc.roundedRect(x,y,addressWidth,addressHeight,5).lineWidth(0.6).strokeColor(color.line).stroke();
    text(label.toUpperCase(),x+12,y+12,addressWidth-24,{size:8,bold:true,fill:color.muted});
    let top=y+32;
    lines.forEach((line,lineIndex)=>{text(line,x+12,top,addressWidth-24,{bold:lineIndex===0,fill:lineIndex===0?color.ink:color.muted});top+=height(line,addressWidth-24,9,lineIndex===0)+3;});
  });
  y+=addressHeight+18;
  const widths=[223,38,38,40,80,92];
  const labels=[t.item,language==='fr'?'Qt\u00e9\ncd\u00e9e':'Qty.\nord.',language==='fr'?'Qt\u00e9\nexp.':'Qty.\nship.',language==='fr'?'Rel.':'B/O',t.price,t.amount];
  function tableHeader() {
    ensure(48);
    doc.rect(M,y,W,44).fill(color.ink);
    let x=M;
    labels.forEach((label,index)=>{text(label,x+7,y+10,widths[index]-14,{size:7.5,bold:true,fill:color.white,align:index===0?'left':'right'});x+=widths[index];});
    y+=44;
  }
  tableHeader();
  for(const [rowIndex,line] of (invoice.lines || []).entries()) {
    const description=wrap(line.description || '-',widths[0]-16,9);
    const code=String(line.item_number || '');
    let offset=0,part=0;
    do {
      if(BOTTOM-y<52){newPage();tableHeader();}
      const codeLabel=part?`${code} (${t.continued})`:code;
      const codeHeight=codeLabel?height(codeLabel,widths[0]-16,7.5,true)+4:0;
      const available=BOTTOM-y;
      const numeric=[line.qty_ordered ?? '-',line.qty_shipped ?? '-',line.qty_backorder ?? '-',money(line.unit_price),money(line.extended_price)];
      const numericHeight=Math.max(...numeric.map((value,index)=>height(value,widths[index+1]-14,8.5)))+26;
      const completeHeight=Math.max(44,(description.length-offset)*13+codeHeight+17,numericHeight);
      // Ordinary rows stay together. Only an item taller than a whole page is split.
      if(part===0 && completeHeight<=BOTTOM-121 && completeHeight>available){newPage();tableHeader();continue;}
      const take=Math.max(1,Math.min(description.length-offset,Math.floor((available-codeHeight-19)/13)));
      const chunk=description.slice(offset,offset+take);
      const rowHeight=Math.max(44,chunk.length*13+codeHeight+17,numericHeight);
      if(rowHeight>available){newPage();tableHeader();continue;}
      if(rowIndex%2===1)doc.rect(M,y,W,rowHeight).fill(color.soft);
      if(codeLabel)text(codeLabel,M+8,y+9,widths[0]-16,{size:7.5,bold:true,fill:color.muted});
      chunk.forEach((lineText,index)=>text(lineText,M+8,y+9+codeHeight+index*13,widths[0]-16,{size:9}));
      if(part===0) {
        let x=M+widths[0];
        numeric.forEach((value,index)=>{
          text(value,x+7,y+12,widths[index+1]-14,{size:8.5,align:'right',bold:index===4});
          if(index===3 && line.uom)text(line.uom,x+7,y+14+height(value,widths[index+1]-14,8.5),widths[index+1]-14,{size:6.5,fill:color.muted,align:'right'});
          x+=widths[index+1];
        });
      }
      y+=rowHeight;rule(y);offset+=take;part++;
    } while(offset<description.length);
  }
  y+=22;
  // Totals stay together; never recompute amounts supplied by ERP.
  const totalFields=[[t.subtotal,invoice.subtotal],[t.tax,invoice.total_tax],[t.total,invoice.total_amount],[t.payment,invoice.less_payment]];
  const totalX=M+W-240,totalHeight=155;
  ensure(totalHeight);
  const totalTop=y;
  doc.roundedRect(totalX,y,240,totalHeight,6).fill(color.soft);
  totalFields.forEach(([label,value],index)=>{
    const top=totalTop+15+index*25;
    text(label,totalX+14,top,120,{size:9,fill:color.muted});
    text(money(value),totalX+131,top,95,{size:10,bold:true,align:'right'});
  });
  doc.rect(totalX,totalTop+119,240,36).fill(color.ink);
  text(t.due,totalX+14,totalTop+131,120,{size:10,bold:true,fill:color.white});
  text(money(invoice.amount_due),totalX+130,totalTop+130,96,{size:12,bold:true,fill:color.white,align:'right'});
  text(t.currencyNote+' '+currency,M,totalTop+4,240,{size:8,fill:color.muted});
  const clauses=['returns_clause','overdue_clause','claims_clause','surcharge_clause'].map(key=>company[key]).filter(Boolean);
  const supporting=[];
  for(const tax of invoice.tax_lines || []) supporting.push(...wrap(`${tax.code}: ${money(tax.amount)}`,240,7.5).map(line=>({line,size:7.5})));
  if(clauses.length) {
    supporting.push({line:'',size:7.2},{line:t.notes,size:8,bold:true});
    for(const clause of clauses) supporting.push(...wrap(clause,240,7.2).map(line=>({line,size:7.2})));
  }
  let supportY=totalTop+25;
  const remaining=[];
  for(const item of supporting) {
    if(supportY+11>totalTop+totalHeight-6)remaining.push(item);
    else {text(item.line,M,supportY,240,{size:item.size,bold:item.bold,fill:color.muted});supportY+=11;}
  }
  y=totalTop+totalHeight+18;
  for(const item of remaining) {ensure(14);text(item.line,M,y,W,{size:item.size,bold:item.bold,fill:color.muted});y+=12;}
  // Buffered pages allow accurate numbering, including continuation pages.
  const pages=doc.bufferedPageRange();
  for(let index=0;index<pages.count;index++) {
    doc.switchToPage(pages.start+index);
    const bottomMargin=doc.page.margins.bottom;
    doc.page.margins.bottom=0;
    rule(786);
    text(`${company.company_name || ''} | ${t.documentCopy}`,M,798,350,{size:7,fill:color.muted,lineBreak:false});
    text(`${t.page} ${index+1} ${t.of} ${pages.count}`,M+360,798,W-360,{size:7,fill:color.muted,align:'right',lineBreak:false});
    doc.page.margins.bottom=bottomMargin;
  }
  doc.end();
}
