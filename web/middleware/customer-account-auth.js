import shopify from "../shopify.js";

// Customer account tokens have a Customer GID in sub, unlike admin tokens.
export async function customerAccountAuth(req, res, next) {
  try {
    const token = /^Bearer (\S+)$/i.exec(req.get("Authorization") || "")?.[1];
    if (!token) return res.status(401).json({ error: "Sign in required" });
    const claims = await shopify.api.session.decodeSessionToken(token);
    if (!/^gid:\/\/shopify\/Customer\/\d+$/.test(claims.sub || "")) {
      return res.status(401).json({ error: "Customer identity unavailable" });
    }
    const dest = String(claims.dest || "").replace(/^https:\/\//, "").replace(/\/$/, "");
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(dest)) {
      return res.status(401).json({ error: "Invalid shop" });
    }
    if (req.signedProxyShop && req.signedProxyShop !== dest.toLowerCase()) {
      return res.status(401).json({ error: "Session shop does not match proxy shop" });
    }
    req.proxyShop = dest.toLowerCase();
    req.loggedInCustomerId = claims.sub.split("/").pop();
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired customer session" });
  }
}
