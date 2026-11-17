import "./load-env.js";
import { existsSync, readFileSync } from "node:fs";

const file = new URL("../shopify.app.toml", import.meta.url);
const toml = existsSync(file) ? readFileSync(file, "utf8") : "";
const setting = key => new RegExp(`^${key}\\s*=\\s*"([^"\\r\\n]*)"`, "m").exec(toml)?.[1];
const proxySection = /\[app_proxy\]([\s\S]*?)(?:\n\[|$)/.exec(toml)?.[1] || "";
const proxyValue = key => new RegExp(`^${key}\\s*=\\s*"([^"\\r\\n]*)"`, "m").exec(proxySection)?.[1];

export function getRuntimeConfig(env = process.env) {
  // Shopify CLI's HOST takes precedence because its development tunnel rotates.
  const appUrl = String(env.HOST || env.SHOPIFY_APP_URL || setting("application_url") || "").replace(/\/$/, "");
  if (appUrl && !/^https?:\/\//.test(appUrl)) throw new Error("SHOPIFY_APP_URL/HOST must be an absolute URL");
  if (appUrl) {
    const parsed = new URL(appUrl);
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
      throw new Error("SHOPIFY_APP_URL/HOST must be an origin without credentials or a path");
    }
  }
  return {
    appUrl,
    apiKey: env.SHOPIFY_API_KEY || setting("client_id") || "",
    scopes: env.SCOPES || setting("scopes") || "",
    shop: String(env.INVOICE_SHOP_DOMAIN || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, ""),
    proxyPath: `/${proxyValue("prefix") || "apps"}/${proxyValue("subpath") || "account-billing"}`,
  };
}
export const runtimeConfig = getRuntimeConfig();
