import "./load-env.js";
import { LATEST_API_VERSION } from "@shopify/shopify-api";
import { shopifyApp } from "@shopify/shopify-app-express";
import { sessionStorage } from "./session-storage.js";
import { runtimeConfig } from "./runtime-config.js";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-10";

const shopify = shopifyApp({
  api: {
    apiKey: runtimeConfig.apiKey,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: runtimeConfig.scopes.split(","),
    hostScheme: new URL(runtimeConfig.appUrl).protocol.replace(":", ""),
    hostName: new URL(runtimeConfig.appUrl).host,
    apiVersion: LATEST_API_VERSION,
    restResources,
    future: {
      customerAddressDefaultFix: true,
      lineItemBilling: true,
      unstable_managedPricingSupport: true,
    },
    billing: undefined, // or replace with billingConfig above to enable example billing
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    path: "/api/webhooks",
  },
  sessionStorage,
});

export default shopify;
