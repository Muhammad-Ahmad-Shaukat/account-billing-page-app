# Customer account invoices

This app provides a `customer-account.page.render` extension for Shopify customer accounts. All invoice data comes from the existing ERP ingest APIs and PostgreSQL store. No Liquid or theme files are required.

## Enable

1. Install dependencies with `npm install` (Node 20 or newer recommended).
2. Configure `.env` and deploy the web app. Keep `SHOPIFY_API_SECRET` in the host environment. `SHOPIFY_API_KEY`, `SCOPES`, and the public app URL default to `shopify.app.toml`. You can override them with `.env`; `npm run configure` syncs explicit public overrides to the TOML. The Dockerfile includes the app configuration and extension locale files used for PDF generation.
3. Run `npm run deploy` to release the extension.
4. Use Shopify's customer account editor to add the Invoices app page, then add it to the customer account navigation menu next to Orders/Profile. Save/publish the account configuration. This requires Shopify customer accounts rather than legacy theme accounts.
5. No backend URL is required in the account editor. The extension first calls the generated direct backend URL so password-protected storefront redirects cannot block customer requests. The shop's stable app proxy address (`https://{shop}.myshopify.com/apps/account-billing/account/...`) remains a fallback for network failures. `npm run dev`, `npm run build`, and `npm run deploy` generate the direct URL from `HOST`, `SHOPIFY_APP_URL`, or `shopify.app.toml`. The backend updates it from Shopify CLI's current tunnel during local development.
6. Ensure the app has protected customer data access so Shopify includes the signed-in Customer GID in session tokens. Missing customer identity fails closed.

English and French are provided. The initial language follows the customer account language, with an explicit language selector. PDFs use the selected language for labels; invoice content remains as supplied by ERP.

## Installed app but no Invoices tab

Installation does not enable a full-page extension in the menu. In Shopify admin, open **Settings → Customer accounts → Customize**. In the checkout and accounts editor open **Apps**, add this app's **Invoices** page, choose **Add to menu**, and save. The page needs to be released on the same app installed on the store. During local development use the extension preview from `npm run dev`. A development preview is not a production release. The storefront/theme editor is not used.

Open the app in Shopify admin for the setup checklist, a customer account settings link, and a live database/token status check. Only an authenticated merchant session can access `/api/setup/status`; it never returns access tokens or the app secret.

## OAuth tokens and database

Both invoices and Shopify OAuth sessions now use `DATABASE_URL`. Shopify's official PostgreSQL storage adapter manages the `shopify_sessions` table and stores access tokens automatically after OAuth. Customer extension bearer tokens remain transient and are verified on each request; they are not OAuth access tokens.

- `npm run check:setup` initializes/checks database tables and reports saved-token counts without displaying tokens.
- `npm run sessions:migrate` copies unexpired legacy `web/database.sqlite` sessions for `INVOICE_SHOP_DOMAIN` to PostgreSQL. Existing valid PostgreSQL sessions and original SQLite records are retained. Set `SHOPIFY_LEGACY_SESSION_DB` to use another source file. Use a source belonging to this Shopify app; if you switch app credentials, reopen/re-authorize the app instead.
- Outside Shopify CLI, the hosted backend needs `SHOPIFY_API_SECRET`. It is not a per-store access token; obtain it from this app's developer dashboard. During `npm run dev` Shopify CLI injects it.
- In production the database must already exist by default. Use `DATABASE_AUTO_CREATE=true` only where the PostgreSQL account has permission to create databases. For PostgreSQL requiring TLS, set `PGSSLMODE=require` (or a stricter certificate-verified mode configured for your host) for the session adapter as well as the invoice connection.
- Restart the backend after changing `.env`. Changing company details affects subsequent previews/PDFs; no extension release is needed for these server settings.

The app stops startup if database/session initialization fails, so an installation cannot silently save tokens to an ephemeral local file.

## App proxy connection

Direct customer account requests use `/api/customer-account/customer/invoices` on the app backend. Proxy requests use `/apps/account-billing/account/customer/invoices` on the shop domain. For proxy requests the backend verifies both Shopify's proxy signature and the customer account bearer token, and requires their shop identities to match. It does not use `logged_in_customer_id`, which is absent in extension worker requests. PDF links use a short-lived invoice capability and a verified proxy signature when downloaded through the proxy.

Shopify does not support UI extension app-proxy requests on password-protected storefronts. This is why the extension now tries the direct backend first. Neither path needs a manually entered URL in the account editor. The app must still be running/hosted, and Shopify's proxy must target that backend. If a merchant customizes the app proxy prefix/subpath, update `[app_proxy]` in the TOML and rebuild so the extension uses the matching path.

## A visible table with HTTP 401

The admin OAuth token saved during app installation is separate from the customer session token. Admin OAuth success does not establish customer identity for the invoice page.

- `customer_identity_missing` / `Customer identity unavailable`: the signed token has no customer GID. Confirm the customer is signed in and enable this app's protected customer data access (level 1 for customer ID) in Shopify's developer dashboard. Refresh the customer session afterward.
- `invalid_customer_session` / `Invalid or expired customer session`: sign in again, then check that Render's app client ID and secret belong to the same Shopify app as the released extension.
- The frontend displays a specific, localized explanation. A definitive HTTP 401/403 is not retried through the storefront proxy.
- New backend logs identify a missing customer claim or failed token verification without printing JWTs. Older backend versions do not log these failures by default; an absence of request logs does not mean the browser's 401 never reached the server.

Read the failed API request's Response JSON in DevTools to distinguish these cases. Never copy its Authorization header or token into logs or chat.

The extension is named **Invoices** in the editor. English and French remain available inside the page. Shopify's generic “There's a problem loading this page” can occur before the extension is mounted; changing a backend address cannot register or activate a missing app page. Use the Apps panel in the customer accounts editor to add and save the actual page, then add its generated link to the menu. Do not manually construct a page URL from the TOML UID.

## Behavior

- Search by invoice/order/PO, filter paid or due invoices, and paginate results.
- Open a complete invoice preview with company, addresses, lines, tax and totals.
- Download server-generated PDFs. Missing required totals disable downloads.
- Customer identity and shop come exclusively from verified Shopify session tokens. Customer IDs from query parameters are never used.
- Download links are signed, scoped to one invoice/customer/shop, expire after five minutes, and recheck ownership when used. Reopen the preview to refresh an expired link. Treat these links as private.
- Existing storefront proxy and ERP integrations remain available for migration.

## Verification before release

The invoice page uses Shopify-native styling: a responsive summary, filter toolbar, horizontally scrollable invoice rows, status badges, and a structured invoice preview. The preview includes company details, billing/shipping cards, order metadata, line items, tax breakdown, and a PDF action. These styles inherit the store's customer account branding; no theme CSS is required.

PDFs use an A4 layout with a company header, order metadata, address blocks, an aligned item table, and a separate totals panel. Standard rows stay together; exceptionally long descriptions continue onto subsequent pages with repeated table headers. Footers include page numbers. All displayed monetary values remain the ERP-supplied values. Merchant-provided descriptions, addresses and terms are preserved; interface and document labels support English and French.

Run `node web/scripts/preview-invoice-design.mjs` to create the English/French samples under `output/pdf` and pagination fixtures under `tmp/pdfs`. Deploy the backend for PDF changes and release the extension for page/preview changes.

Run `npm run build` and test with two customer accounts and a different shop: list, detail and PDF must never cross customer/shop boundaries. Test English/French, empty results, search, pagination, incomplete totals, expired tokens and expired/tampered PDF links. Confirm downloaded PDFs with a multi-page invoice.
