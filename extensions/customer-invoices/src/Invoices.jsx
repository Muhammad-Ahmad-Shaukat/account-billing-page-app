/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import en from '../locales/en.default.json';
import fr from '../locales/fr.json';
import {fetchInvoices} from './invoice-api.js';
import {addressLines} from './invoice-format.js';

export default async () => { render(<Invoices />, document.body); };
const columns = 'minmax(190px, 2fr) 110px minmax(100px, 1fr) 110px 110px 110px';
const lineColumns = 'minmax(250px, 3fr) 100px 125px 125px';
const responsive = 'repeat(auto-fit, minmax(220px, 1fr))';
const fieldValue = event => /** @type {HTMLInputElement} */ (event.currentTarget).value;

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
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [invoiceId, setInvoiceId] = useState(null);
  const locale = language === 'fr' ? 'fr-CA' : 'en-CA';
  const money = (value, currency = 'CAD') => value == null || value === '' ? '\u2014' : new Intl.NumberFormat(locale, {style: 'currency', currency}).format(Number(value));
  const date = (value) => !value || !Number.isFinite(new Date(value).getTime()) ? '\u2014' : new Intl.DateTimeFormat(locale, {dateStyle:'medium',timeZone:'UTC'}).format(new Date(value));
  useEffect(() => {
    const timer = setTimeout(() => {setQuery(search); setPage(1);}, 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let active = true;
    setBusy(true); setError(''); setSelected(null);
    async function load() {
      try {
        const token = await shopify.sessionToken.get();
        const path = invoiceId ? `/${encodeURIComponent(invoiceId)}` : `?page=${page}&q=${encodeURIComponent(query)}&balance=${balance}`;
        const {payload: data, apiBase} = await fetchInvoices(path, token);
        if (active) invoiceId ? setSelected({...data.data, apiBase}) : setResult(data);
      } catch (failure) { if (active) setError(failure.code || 'invoice_service_unavailable'); }
      finally { if (active) setBusy(false); }
    }
    load();
    return () => {active = false;};
  }, [page, query, balance, retry, invoiceId]);
  const summary = result.meta.summary;
  const count = result.meta.total ?? result.data.length;
  return <s-page heading={invoiceId ? `${t.invoice}${selected ? ` ${selected.invoice_number}` : ''}` : t.title}>
    <s-stack direction="block" gap="large">
      <s-grid gridTemplateColumns="1fr auto" gap="large" alignItems="end">
        <s-stack direction="block" gap="small">
          {invoiceId ? <s-button variant="secondary" onClick={() => setInvoiceId(null)}>{t.back}</s-button> : <s-paragraph color="subdued">{t.intro}</s-paragraph>}
        </s-stack>
        <s-box minInlineSize="140px">
          <s-select label={t.language} value={language} onChange={(event) => setLanguage(fieldValue(event))}>
            <s-option value="en">English</s-option><s-option value="fr">Français</s-option>
          </s-select>
        </s-box>
      </s-grid>
      {error && <s-banner tone="critical" heading={t.error}><s-paragraph>{t[error] || t.invoice_service_unavailable}</s-paragraph><s-button onClick={() => setRetry(retry + 1)}>{t.retry}</s-button></s-banner>}
      {busy && <s-stack direction="inline" gap="base" alignItems="center"><s-spinner accessibilityLabel={t.loading} /><s-text color="subdued">{t.loading}</s-text></s-stack>}
      {!invoiceId && <>
        {summary && <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))" gap="base">
          <Metric label={t.totalInvoices} value={summary.total_invoices} />
          <Metric label={t.paidInvoices} value={summary.paid} />
          <Metric label={t.openInvoices} value={summary.pending} />
          {result.meta.outstanding_balance != null && <Metric label={t.accountBalance} value={money(result.meta.outstanding_balance,result.meta.outstanding_currency)} />}
        </s-grid>}
        <s-section heading={t.all}>
          <s-stack direction="block" gap="large">
            <s-grid gridTemplateColumns={responsive} gap="base" alignItems="end">
              <s-text-field label={t.search} value={search} onInput={(event) => setSearch(fieldValue(event))} />
              <s-select label={t.status} value={balance} onChange={(event) => {setBalance(fieldValue(event)); setPage(1);}}>
                <s-option value="">{t.all}</s-option><s-option value="due">{t.due}</s-option><s-option value="paid">{t.paid}</s-option>
              </s-select>
            </s-grid>
            <s-scroll-box overflow="hidden auto" accessibilityLabel={t.all} border="base" borderRadius="base">
              <s-box minInlineSize="850px">
                <s-grid gridTemplateColumns={columns} gap="base" padding="base" background="subdued" alignItems="center">
                  {[t.invoice,t.date,t.order,t.status,t.total,t.actions].map((label,index) => <s-stack key={label} direction="block" alignItems={index===4?'end':'start'}><s-text type="strong">{label}</s-text></s-stack>)}
                </s-grid>
                {!busy && !error && result.data.map((invoice,index) => <InvoiceRow key={invoice.id} invoice={invoice} shaded={index%2===1} t={t} money={money} date={date} open={() => setInvoiceId(invoice.id)} />)}
              </s-box>
            </s-scroll-box>
            {!busy && !error && !result.data.length && <s-box padding="large" background="subdued" borderRadius="base"><s-paragraph>{t.empty}</s-paragraph></s-box>}
            <s-stack direction="inline" gap="base" justifyContent="space-between" alignItems="center">
              <s-text color="subdued">{count} {t.results} · {t.page} {page} {t.of} {result.meta.totalPages}</s-text>
              <s-stack direction="inline" gap="small">
                <s-button disabled={busy || !!error || page <= 1} onClick={() => setPage(page - 1)}>{t.previous}</s-button>
                <s-button disabled={busy || !!error || page >= result.meta.totalPages} onClick={() => setPage(page + 1)}>{t.next}</s-button>
              </s-stack>
            </s-stack>
          </s-stack>
        </s-section>
      </>}
      {!busy && selected && <InvoicePreview invoice={selected} t={t} language={language} money={money} date={date} />}
    </s-stack>
  </s-page>;
}

function Metric({label,value}) {
  return <s-box padding="large" border="base" borderRadius="base" background="subdued"><s-stack direction="block" gap="small"><s-text color="subdued" type="small">{label}</s-text><s-heading>{value}</s-heading></s-stack></s-box>;
}
function Status({invoice,t}) {
  const known=invoice.amount_due!=null && invoice.amount_due!=='';
  return <s-box><s-badge tone={known && Number(invoice.amount_due)>0 ? 'critical' : 'neutral'}>{!known?t.unknown:Number(invoice.amount_due)>0?t.unpaid:t.paid}</s-badge></s-box>;
}
function InvoiceRow({invoice,shaded,t,money,date,open}) {
  return <s-grid gridTemplateColumns={columns} gap="base" padding="base" background={shaded?'subdued':'base'} alignItems="center" borderWidth="none none base none" borderStyle="solid">
    <s-stack direction="block" gap="small"><s-text type="strong">{invoice.invoice_number}</s-text><s-text color="subdued" type="small">{invoice.currency} · {t.revision} {invoice.revision ?? 1}</s-text></s-stack>
    <s-text>{date(invoice.invoice_date)}</s-text><s-text color="subdued">{invoice.order_no || '\u2014'}</s-text>
    <Status invoice={invoice} t={t} /><s-stack direction="block" alignItems="end"><s-text type="strong">{money(invoice.total_amount,invoice.currency)}</s-text></s-stack><s-button onClick={open}>{t.preview}</s-button>
  </s-grid>;
}
function Field({label,value}) {
  return <s-stack direction="block" gap="small"><s-text type="small" color="subdued">{label}</s-text><s-text type="strong">{value || '\u2014'}</s-text></s-stack>;
}
function Address({label,value}) {
  return <s-box padding="large" border="base" borderRadius="base"><s-stack direction="block" gap="base"><s-heading>{label}</s-heading><s-stack direction="block" gap="small">{addressLines(value).map((line,index)=><s-text key={index} color={index===0?'base':'subdued'} type={index===0?'strong':'generic'}>{line}</s-text>)}</s-stack></s-stack></s-box>;
}
function InvoicePreview({invoice,t,language,money,date}) {
  const company=invoice.company || {};
  const amount=value=>money(value,invoice.currency);
  const clauses=['returns_clause','overdue_clause','claims_clause','surcharge_clause'].map(key=>company[key]).filter(Boolean);
  return <s-stack direction="block" gap="large">
    {!invoice.downloadable && <s-banner tone="warning">{t.incomplete}</s-banner>}
    <s-section>
      <s-stack direction="block" gap="large">
        <s-grid gridTemplateColumns={responsive} gap="large" alignItems="start">
          <s-stack direction="block" gap="base">
            {company.logo_url && <s-box maxInlineSize="150px"><s-image src={company.logo_url} alt={company.company_name || t.invoice} objectFit="contain" /></s-box>}
            <s-heading>{company.company_name}</s-heading>
            <s-stack direction="block" gap="small">{[company.street_address1,company.street_address2,company.telephone,company.fax?`${t.fax}: ${company.fax}`:null].filter(Boolean).map((line,index)=><s-text color="subdued" key={index}>{line}</s-text>)}</s-stack>
            {(company.tax_registration_no || invoice.tax_registration_no) && <s-text color="subdued" type="small">{t.taxRegistration}: {company.tax_registration_no || invoice.tax_registration_no}</s-text>}
          </s-stack>
          <s-box background="subdued" borderRadius="base" padding="large">
            <s-stack direction="block" gap="base">
              <Status invoice={invoice} t={t} />
              <s-text color="subdued">{t.due} · {invoice.currency}</s-text><s-heading>{amount(invoice.amount_due)}</s-heading>
              {invoice.pdf_path && <s-button variant="primary" href={`${invoice.apiBase}${invoice.pdf_path}&lang=${language}`} target="_blank">{t.download}</s-button>}
            </s-stack>
          </s-box>
        </s-grid>
        <s-divider />
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(140px, 1fr))" gap="large">
          <Field label={t.invoice} value={invoice.invoice_number} /><Field label={t.date} value={date(invoice.invoice_date)} /><Field label={t.order} value={invoice.order_no} /><Field label={t.po} value={invoice.po_number} />
          <Field label={t.terms} value={invoice.terms} /><Field label={t.customerNumber} value={invoice.customer_no} /><Field label={t.shipVia} value={invoice.ship_via} /><Field label={t.salesperson} value={invoice.salesperson} />
        </s-grid>
      </s-stack>
    </s-section>
    <s-grid gridTemplateColumns={responsive} gap="base"><Address label={t.soldTo} value={invoice.sold_to} /><Address label={t.shipTo} value={invoice.ship_to} /></s-grid>
    <s-section heading={t.lineItems}>
      <s-stack direction="block" gap="large">
        <s-scroll-box overflow="hidden auto" accessibilityLabel={t.lineItems} border="base" borderRadius="base">
          <s-box minInlineSize="680px">
            <s-grid gridTemplateColumns={lineColumns} gap="base" padding="base" background="subdued">{[t.item,t.quantity,t.price,t.amount].map((label,index)=><s-stack key={label} direction="block" alignItems={index>=2?'end':'start'}><s-text type="strong">{label}</s-text></s-stack>)}</s-grid>
            {(invoice.lines || []).map((line,index)=><s-grid key={index} gridTemplateColumns={lineColumns} gap="base" padding="base" background={index%2?'subdued':'base'} alignItems="center" borderWidth="none none base none" borderStyle="solid">
              <s-stack direction="block" gap="small"><s-text type="strong">{line.description || line.item_number}</s-text><s-text type="small" color="subdued">{line.item_number} · {t.ordered}: {line.qty_ordered ?? '\u2014'} · {t.backordered}: {line.qty_backorder ?? '\u2014'}</s-text></s-stack>
              <s-text>{line.qty_shipped ?? '\u2014'} {line.uom}</s-text><s-stack direction="block" alignItems="end"><s-text>{amount(line.unit_price)}</s-text></s-stack><s-stack direction="block" alignItems="end"><s-text type="strong">{amount(line.extended_price)}</s-text></s-stack>
            </s-grid>)}
          </s-box>
        </s-scroll-box>
        <s-grid gridTemplateColumns={responsive} gap="large" alignItems="start">
          <s-stack direction="block" gap="base">
            {!!invoice.tax_lines?.length && <><s-heading>{t.taxDetails}</s-heading>{invoice.tax_lines.map((tax,index)=><s-text color="subdued" key={index}>{tax.code}: {amount(tax.amount)}</s-text>)}</>}
            <s-text type="small" color="subdued">{t.currencyNote} {invoice.currency}</s-text>
          </s-stack>
          <s-box padding="large" background="subdued" borderRadius="base"><s-stack direction="block" gap="base">
            {[[t.subtotal,'subtotal'],[t.tax,'total_tax'],[t.total,'total_amount'],[t.payment,'less_payment']].map(([label,key])=><s-grid key={key} gridTemplateColumns="1fr auto" gap="base"><s-text color="subdued">{label}</s-text><s-text type="strong">{amount(invoice[key])}</s-text></s-grid>)}
            <s-divider /><s-grid gridTemplateColumns="1fr auto" gap="base"><s-text type="strong">{t.due}</s-text><s-text type="strong">{amount(invoice.amount_due)}</s-text></s-grid>
          </s-stack></s-box>
        </s-grid>
      </s-stack>
    </s-section>
    {!!clauses.length && <s-section heading={t.notes}><s-stack direction="block" gap="small">{clauses.map((clause,index)=><s-text type="small" color="subdued" key={index}>{clause}</s-text>)}</s-stack></s-section>}
  </s-stack>;
}
