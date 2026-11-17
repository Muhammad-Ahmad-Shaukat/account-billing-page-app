import { Router } from "express";
import { pool } from "../db.js";
import { runtimeConfig } from "../runtime-config.js";

const router = Router();
router.get("/status", async (_req, res) => {
  const session = res.locals.shopify.session;
  res.set("Cache-Control", "private, no-store");
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS sessions,
       COUNT(*) FILTER (WHERE "accessToken" IS NOT NULL AND "accessToken" <> ''
         AND ("expires" IS NULL OR "expires" > EXTRACT(EPOCH FROM NOW())))::int AS valid_tokens
       FROM shopify_sessions WHERE shop = $1`, [session.shop]);
    const invoices = await pool.query("SELECT COUNT(*)::int AS total FROM invoices WHERE shop = $1", [session.shop]);
    return res.json({
      shop: session.shop,
      app_url: runtimeConfig.appUrl,
      database: "connected",
      session_storage: "PostgreSQL",
      sessions_saved: result.rows[0].sessions,
      access_token_saved: result.rows[0].valid_tokens > 0,
      invoices: invoices.rows[0].total,
      ingest_secret_configured: Boolean(process.env.INVOICE_INGEST_SECRET),
      invoice_shop_matches: !runtimeConfig.shop || runtimeConfig.shop === session.shop,
      customer_accounts_settings_url: `https://admin.shopify.com/store/${session.shop.replace(/\.myshopify\.com$/, "")}/settings/customer_accounts`,
    });
  } catch {
    return res.status(503).json({ error: "Database setup check failed. Check server logs and DATABASE_URL." });
  }
});
export default router;
