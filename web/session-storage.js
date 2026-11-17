import "./load-env.js";
import { PostgreSQLSessionStorage } from "@shopify/shopify-app-session-storage-postgresql";
import { DATABASE_URL } from "./db.js";

let storage;
let ready;
export function initializeSessionStorage() {
  if (!ready) {
    storage = new PostgreSQLSessionStorage(DATABASE_URL, { sessionTableName: "shopify_sessions" });
    ready = storage.ready.then(() => storage);
  }
  return ready;
}

// Initialize after the invoice database exists, before accepting OAuth callbacks.
export const sessionStorage = Object.fromEntries(
  ["storeSession", "loadSession", "deleteSession", "deleteSessions", "findSessionsByShop"].map(method => [
    method, async (...args) => (await initializeSessionStorage())[method](...args),
  ]),
);
