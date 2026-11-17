import backend from './backend-url.json' with {type: 'json'};

export function connectionCandidates(token) {
  const encoded = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
  const claims = JSON.parse(atob(encoded));
  // This decoding is only a routing hint. The server verifies the signed token.
  const domain = String(claims.dest || '').replace(/^https:\/\//, '').replace(/\/$/, '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) throw new Error('Invalid Shopify session destination');
  const proxyPath = backend.proxyPath || '/apps/account-billing';
  // A direct request works on password-protected shops, whose proxy preflights redirect.
  const candidates = [];
  if (backend.appUrl?.startsWith('https://')) candidates.push(`${backend.appUrl.replace(/\/$/, '')}/api/customer-account`);
  candidates.push(`https://${domain}${proxyPath}/account`);
  return candidates;
}

export async function fetchInvoices(path, token) {
  let lastError;
  for (const apiBase of connectionCandidates(token)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${apiBase}/customer/invoices${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'omit',
        signal: controller.signal,
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
        const error = Object.assign(new Error('Invoice request failed'), {status: response.status, code: ''});
        const data = await response.json().catch(() => ({}));
        error.code = data.code || (
          data.error === 'Customer identity unavailable' ? 'customer_identity_missing' :
          response.status === 401 ? 'invalid_customer_session' :
          response.status === 403 ? 'customer_access_denied' : 'invoice_service_unavailable'
        );
        throw error;
      }
      return { payload: await response.json(), apiBase };
    } catch (error) {
      // A signed-in identity/configuration error will not be fixed by another transport.
      if (error.status === 401 || error.status === 403) throw error;
      lastError = error;
    } finally { clearTimeout(timer); }
  }
  throw lastError || new Error('Invoice service unavailable');
}
