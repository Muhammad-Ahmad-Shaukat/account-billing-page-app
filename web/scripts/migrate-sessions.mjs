import '../load-env.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SQLiteSessionStorage } from '@shopify/shopify-app-session-storage-sqlite';
import { migrate } from '../db.js';
import { initializeSessionStorage } from '../session-storage.js';
import { runtimeConfig } from '../runtime-config.js';

try {
  const sourcePath = process.env.SHOPIFY_LEGACY_SESSION_DB || fileURLToPath(new URL('../database.sqlite', import.meta.url));
  if (!runtimeConfig.shop) throw new Error('Set INVOICE_SHOP_DOMAIN before migrating existing Shopify sessions.');
  if (!existsSync(sourcePath)) {
    console.log('No legacy SQLite file found. Opening the app in Shopify will save its OAuth session in PostgreSQL.');
    process.exit(0);
  }
  await migrate();
  const target = await initializeSessionStorage();
  const source = new SQLiteSessionStorage(sourcePath);
  const sessions = await source.findSessionsByShop(runtimeConfig.shop);
  let copied = 0;
  for (const session of sessions) {
    if (!session.accessToken || session.isExpired()) continue;
    const existing = await target.loadSession(session.id);
    // Keep newer PostgreSQL tokens when a merchant has already authenticated again.
    if (existing?.accessToken && !existing.isExpired()) continue;
    await target.storeSession(session);
    copied++;
  }
  console.log(`Copied ${copied} existing Shopify sessions to PostgreSQL; original SQLite records retained. No tokens printed.`);
  process.exit(0);
} catch (error) {
  console.error('Session migration failed:', error.code || error.name);
  process.exit(1);
}
