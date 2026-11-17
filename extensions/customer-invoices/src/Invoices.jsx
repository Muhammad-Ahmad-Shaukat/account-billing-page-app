import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import en from '../locales/en.default.json';
import fr from '../locales/fr.json';
import {fetchInvoices} from './invoice-api.js';

export default () => render(<Invoices />, document.body);

function Invoices() {
  const [language, setLanguage] = useState(shopify.localization?.language?.value?.isoCode?.startsWith('fr') ? 'fr' : 'en');
  const t = language === 'fr' ? fr : en;
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [balance, setBalance] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({data: [], meta: {totalPages: 1}});
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [invoiceId, setInvoiceId] = useState(null);
  const money = (value, currency = 'CAD') => value == null || value === '' ? '—' : new Intl.NumberFormat(language === 'fr' ? 'fr-CA' : 'en-CA', {style: 'currency', currency}).format(Number(value));
  const date = (value) => value ? new Intl.DateTimeFormat(language === 'fr' ? 'fr-CA' : 'en-CA', {timeZone: 'UTC'}).format(new Date(value)) : '—';
  useEffect(() => {
    const timer = setTimeout(() => {setQuery(search); setPage(1);}, 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let active = true;
    setBusy(true); setError(false); setSelected(null);
    async function load() {
      try {
        const token = await shopify.sessionToken.get();
        const path = invoiceId ? `/${encodeURIComponent(invoiceId)}` : `?page=${page}&q=${encodeURIComponent(query)}&balance=${balance}`;
        const {payload: data, apiBase} = await fetchInvoices(path, token);
        if (active) invoiceId ? setSelected({...data.data, apiBase}) : setResult(data);
      } catch { if (active) setError(true); }
      finally { if (active) setBusy(false); }
    }
    load();
    return () => {active = false;};
  }, [page, query, balance, retry, invoiceId]);
  const address = (value) => typeof value === 'object' && value ? Object.values(value).filter(Boolean).join(', ') : value || '—';
  return <s-page heading={t.title}>
    <s-stack gap="base">
      <s-select label={t.language} value={language} onChange={(event) => setLanguage(event.currentTarget.value)}>
        <s-option value="en">English</s-option><s-option value="fr">Français</s-option>
      </s-select>
      {invoiceId && <s-button onClick={() => setInvoiceId(null)}>{t.back}</s-button>}
      {error && <s-banner tone="critical" heading={t.error}><s-button onClick={() => setRetry(retry + 1)}>{t.retry}</s-button></s-banner>}
      {busy && <s-spinner accessibilityLabel={t.loading} />}
      {!invoiceId && <>
        <s-text-field label={t.search} value={search} onInput={(event) => setSearch(event.currentTarget.value)} />
        <s-select label={t.status} value={balance} onChange={(event) => {setBalance(event.currentTarget.value); setPage(1);}}>
          <s-option value="">{t.all}</s-option><s-option value="due">{t.due}</s-option><s-option value="paid">{t.paid}</s-option>
        </s-select>
        {!busy && !error && <s-section>
          {result.meta.outstanding_balance != null && <s-paragraph>{t.due}: {money(result.meta.outstanding_balance, result.meta.outstanding_currency)}</s-paragraph>}
          <s-grid gridTemplateColumns="repeat(5, 1fr)" gap="base">
            {[t.invoice, t.date, t.order, t.total, t.actions].map(label => <s-text key={label} type="strong">{label}</s-text>)}
            {result.data.map(invoice => <InvoiceRow key={invoice.id} invoice={invoice} t={t} money={money} date={date} open={() => setInvoiceId(invoice.id)} />)}
          </s-grid>
          {!result.data.length && <s-paragraph>{t.empty}</s-paragraph>}
          <s-stack direction="inline" gap="base">
            <s-button disabled={page <= 1} onClick={() => setPage(page - 1)}>{t.previous}</s-button>
            <s-text>{t.page} {page} {t.of} {result.meta.totalPages}</s-text>
            <s-button disabled={page >= result.meta.totalPages} onClick={() => setPage(page + 1)}>{t.next}</s-button>
          </s-stack>
        </s-section>}
      </>}
      {!busy && selected && <s-section heading={`${t.invoice} ${selected.invoice_number}`}>
        {!selected.downloadable && <s-banner tone="warning">{t.incomplete}</s-banner>}
        {selected.pdf_path && <s-link href={`${selected.apiBase}${selected.pdf_path}&lang=${language}`} target="_blank">{t.download}</s-link>}
        <s-paragraph>{selected.company.company_name}</s-paragraph>
        <s-paragraph>{[selected.company.street_address1, selected.company.street_address2, selected.company.telephone].filter(Boolean).join(', ')}</s-paragraph>
        <s-paragraph>{t.date}: {date(selected.invoice_date)} · {t.order}: {selected.order_no || '—'} · {t.po}: {selected.po_number || '—'}</s-paragraph>
        <s-paragraph>{t.terms}: {selected.terms || '—'}</s-paragraph>
        <s-paragraph>{t.soldTo}: {address(selected.sold_to)}</s-paragraph>
        <s-paragraph>{t.shipTo}: {address(selected.ship_to)}</s-paragraph>
        <s-grid gridTemplateColumns="2fr 1fr 1fr 1fr" gap="base">
          {[t.item,t.quantity,t.price,t.amount].map(label => <s-text type="strong" key={label}>{label}</s-text>)}
          {selected.lines.map((line, index) => <Line key={index} line={line} money={value => money(value, selected.currency)} />)}
        </s-grid>
        {[[t.subtotal,'subtotal'],[t.tax,'total_tax'],[t.total,'total_amount'],[t.payment,'less_payment'],[t.due,'amount_due']].map(([label,key]) => <s-paragraph key={key}>{label}: {money(selected[key], selected.currency)}</s-paragraph>)}
        {selected.tax_lines.map((tax,index) => <s-paragraph key={index}>{tax.code}: {money(tax.amount,selected.currency)}</s-paragraph>)}
      </s-section>}
    </s-stack>
  </s-page>;
}

function InvoiceRow({invoice,t,money,date,open}) {
  return <><s-text>{invoice.invoice_number}</s-text><s-text>{date(invoice.invoice_date)}</s-text><s-text>{invoice.order_no || '—'}</s-text><s-stack><s-text>{money(invoice.total_amount,invoice.currency)}</s-text><s-text>{invoice.amount_due == null ? t.unknown : Number(invoice.amount_due) > 0 ? t.due : t.paid}</s-text></s-stack><s-button onClick={open}>{t.preview}</s-button></>;
}
function Line({line,money}) {
  return <><s-text>{line.item_number} {line.description}</s-text><s-text>{line.qty_shipped ?? '—'} {line.uom}</s-text><s-text>{money(line.unit_price)}</s-text><s-text>{money(line.extended_price)}</s-text></>;
}
