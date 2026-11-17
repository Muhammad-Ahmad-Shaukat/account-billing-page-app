import '../load-env.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Session } from '@shopify/shopify-api';
import { migrate, pool } from '../db.js';
import { sessionStorage } from '../session-storage.js';

const id = `storage-test-${randomUUID()}`;
try {
  await migrate();
  const session = new Session({ id, shop: 'session-storage-test.myshopify.com', state: 'test', isOnline: false });
  session.accessToken = 'test-only-not-a-shopify-token';
  await sessionStorage.storeSession(session);
  const row = await pool.query('SELECT "accessToken" FROM shopify_sessions WHERE id = $1', [id]);
  assert.equal(row.rows[0].accessToken, session.accessToken);
  const loaded = await sessionStorage.loadSession(id);
  assert.equal(loaded.accessToken, session.accessToken);
  assert.equal(loaded.isOnline, false);
  await sessionStorage.deleteSession(id);
  assert.equal(await sessionStorage.loadSession(id), undefined);
  console.log('PostgreSQL session round trip passed; test record removed.');
  process.exit(0);
} catch (error) {
  await pool.query('DELETE FROM shopify_sessions WHERE id = $1', [id]).catch(() => {});
  console.error('Session storage test failed:', error.code || error.name);
  process.exit(1);
}
