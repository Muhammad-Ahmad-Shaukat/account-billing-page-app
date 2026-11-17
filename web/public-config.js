import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { runtimeConfig } from "./runtime-config.js";

export function writePublicExtensionConfig() {
  const url = new URL("../extensions/customer-invoices/src/backend-url.json", import.meta.url);
  const value = JSON.stringify({ appUrl: runtimeConfig.appUrl, proxyPath: runtimeConfig.proxyPath }, null, 2) + "\n";
  // Deliberately export only the public URL, never environment variables or credentials.
  if (!existsSync(url) || readFileSync(url, "utf8") !== value) writeFileSync(url, value);
}
