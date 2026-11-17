import PDFDocument from "pdfkit";
import { readFileSync } from "node:fs";
const en = JSON.parse(readFileSync(new URL("../../extensions/customer-invoices/locales/en.default.json", import.meta.url)));
const fr = JSON.parse(readFileSync(new URL("../../extensions/customer-invoices/locales/fr.json", import.meta.url)));

export function streamInvoicePdf(res, invoice, language) {
  const t = language === "fr" ? fr : en;
  const locale = language === "fr" ? "fr-CA" : "en-CA";
  const money = (value) => value == null || value === "" ? "—" : new Intl.NumberFormat(locale, { style: "currency", currency: invoice.currency }).format(Number(value));
  const doc = new PDFDocument({ size: "A4", margin: 45, bufferPages: true });
  const filename = String(invoice.invoice_number).replace(/[^a-zA-Z0-9_-]/g, "_");
  res.set("Content-Type", "application/pdf");
  res.set("Content-Disposition", `attachment; filename="invoice-${filename}.pdf"`);
  doc.on("error", () => res.destroy());
  doc.pipe(res);
  const text = (value) => doc.fontSize(10).text(String(value ?? "—"));
  const space = () => { if (doc.y > 710) doc.addPage(); };
  doc.fontSize(20).text(`${t.invoice} ${invoice.invoice_number}`);
  doc.moveDown();
  for (const key of ["company_name", "street_address1", "street_address2", "telephone", "fax", "tax_registration_no"]) {
    if (invoice.company[key]) text(invoice.company[key]);
  }
  text(`${t.date}: ${String(invoice.invoice_date || "").slice(0, 10)}`);
  for (const [label, key] of [[t.order,"order_no"],[t.po,"po_number"],[t.terms,"terms"]]) text(`${label}: ${invoice[key] || "—"}`);
  for (const [label, key] of [[t.soldTo,"sold_to"],[t.shipTo,"ship_to"]]) {
    doc.moveDown(); text(label);
    const address = invoice[key];
    text(typeof address === "object" && address ? Object.values(address).filter(Boolean).join(", ") : address);
  }
  doc.moveDown(); text(`${t.item} | ${t.quantity} | ${t.price} | ${t.amount}`);
  for (const line of invoice.lines || []) {
    space();
    text(`${line.item_number || ""} ${line.description || ""}`);
    text(`${line.qty_shipped ?? "—"} ${line.uom || ""} | ${money(line.unit_price)} | ${money(line.extended_price)}`);
    doc.moveDown(0.5);
  }
  space(); doc.moveDown();
  for (const [label, key] of [[t.subtotal,"subtotal"],[t.tax,"total_tax"],[t.total,"total_amount"],[t.payment,"less_payment"],[t.due,"amount_due"]]) text(`${label}: ${money(invoice[key])}`);
  for (const tax of invoice.tax_lines || []) { space(); text(`${tax.code}: ${money(tax.amount)}`); }
  doc.end();
}
