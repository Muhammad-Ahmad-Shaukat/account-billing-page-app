import shopify from "../shopify.js";

/**
 * Validate Shopify app proxy signature and require a logged-in customer.
 * Sets req.proxyShop and req.loggedInCustomerId.
 */
export async function appProxySignature(req, res, next) {
  try {
    const query = { ...req.query };
    // Express may parse arrays; flatten to strings for HMAC
    for (const key of Object.keys(query)) {
      if (Array.isArray(query[key])) {
        query[key] = query[key].join(",");
      } else if (query[key] != null) {
        query[key] = String(query[key]);
      }
    }

    const valid = await shopify.api.utils.validateHmac(query, {
      signator: "appProxy",
    });

    if (!valid) {
      return res.status(401).json({ error: "Invalid proxy signature" });
    }

    const shop = String(query.shop || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");

    if (!shop) {
      return res.status(400).json({ error: "Missing shop" });
    }

    req.proxyShop = shop;
    req.signedProxyShop = shop;
    return next();
  } catch (err) {
    console.error("[app-proxy-auth]", err.message);
    return res.status(401).json({ error: "Invalid proxy signature" });
  }
}

export function appProxyAuth(req, res, next) {
  return appProxySignature(req, res, () => {
    const customer = String(req.query.logged_in_customer_id || "").trim();
    if (!customer) return res.status(401).json({ error: "Customer must be signed in" });
    req.loggedInCustomerId = customer;
    return next();
  });
}
