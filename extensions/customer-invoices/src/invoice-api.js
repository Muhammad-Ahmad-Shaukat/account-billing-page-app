import backend from './backend-url.json' with {type: 'json'};

export function connectionCandidates(token) {
  const encoded = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
  const claims = JSON.parse(atob(encoded));
  // This decoding is only a routing hint. The server verifies the signed token.
  const domain = String(claims.dest || '').replace(/^https:\/\//, '').replace(/\/$/, '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) throw new Error('Invalid Shopify session destination');
  const proxyPath = backend.proxyPath || '/apps/account-billing';
  const candidates = [`https://${domain}${proxyPath}/account`];
  if (backend.appUrl?.startsWith('https://')) candidates.push(`${backend.appUrl.replace(/\/$/, '')}/api/customer-account`);
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
        const error = new Error('Invoice request failed');
        error.status = response.status;
        throw error;
      }
      return { payload: await response.json(), apiBase };
    } catch (error) {
      lastError = error;
    } finally { clearTimeout(timer); }
  }
  throw lastError || new Error('Invoice service unavailable');
}
