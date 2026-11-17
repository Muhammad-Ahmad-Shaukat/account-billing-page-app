import '../load-env.js';
import { migrate, pool } from '../db.js';
import { initializeSessionStorage } from '../session-storage.js';
import { runtimeConfig } from '../runtime-config.js';

try {
  await migrate();
  await initializeSessionStorage();
  const result = await pool.query(`SELECT shop, COUNT(*)::int AS sessions,
    COUNT(*) FILTER (WHERE "accessToken" IS NOT NULL AND "accessToken" <> ''
      AND ("expires" IS NULL OR "expires" > EXTRACT(EPOCH FROM NOW())))::int AS valid_tokens
    FROM shopify_sessions GROUP BY shop`);
  console.log(JSON.stringify({
    database: 'connected', session_storage: 'PostgreSQL',
    shopify_client_id_configured: Boolean(runtimeConfig.apiKey),
    shopify_secret_available: Boolean(process.env.SHOPIFY_API_SECRET),
    app_url_configured: Boolean(runtimeConfig.appUrl),
    ingest_secret_configured: Boolean(process.env.INVOICE_INGEST_SECRET),
    sessions: result.rows,
    note: 'Shopify CLI supplies the app secret during npm run dev. No raw tokens are printed.',
  }, null, 2));
  process.exit(0);
} catch (error) {
  console.error('Setup check failed:', error.code || error.name);
  process.exit(1);
}
