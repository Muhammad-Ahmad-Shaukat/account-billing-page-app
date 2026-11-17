import { writePublicExtensionConfig } from '../public-config.js';
import { readFileSync, writeFileSync } from 'node:fs';

// Explicit environment overrides also update the public configuration Shopify CLI deploys.
const file = new URL('../../shopify.app.toml', import.meta.url);
let toml = readFileSync(file, 'utf8');
if (process.env.SHOPIFY_API_KEY) {
  if (!/^[a-z0-9]+$/i.test(process.env.SHOPIFY_API_KEY)) throw new Error('Invalid SHOPIFY_API_KEY');
  toml = toml.replace(/^client_id\s*=.*$/m, `client_id = ${JSON.stringify(process.env.SHOPIFY_API_KEY)}`);
}
if (process.env.SCOPES) {
  if (!/^[a-z_,\s]+$/i.test(process.env.SCOPES)) throw new Error('Invalid SCOPES');
  toml = toml.replace(/^scopes\s*=.*$/m, `scopes = ${JSON.stringify(process.env.SCOPES.replace(/\s/g, ''))}`);
}
if (process.env.SHOPIFY_APP_URL) {
  const url = new URL(process.env.SHOPIFY_APP_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('SHOPIFY_APP_URL must be an HTTPS origin without credentials or a path.');
  }
  const origin = url.origin;
  toml = toml.replace(/^application_url\s*=.*$/m, `application_url = ${JSON.stringify(origin)}`);
  toml = toml.replace(/redirect_urls\s*=\s*\[[\s\S]*?\]/, `redirect_urls = ${JSON.stringify([`${origin}/api/auth`, `${origin}/api/auth/callback`])}`);
  toml = toml.replace(/(\[app_proxy\][\s\S]*?^url\s*=)\s*.*$/m, `$1 ${JSON.stringify(`${origin}/api/proxy`)}`);
}
if (readFileSync(file, 'utf8') !== toml) writeFileSync(file, toml);
writePublicExtensionConfig();
console.log('Customer invoice extension backend configured from environment/app configuration.');
