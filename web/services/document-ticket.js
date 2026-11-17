import { createHmac, timingSafeEqual } from "node:crypto";

function sign(value) {
  if (!process.env.SHOPIFY_API_SECRET) throw new Error("Missing app secret");
  return createHmac("sha256", process.env.SHOPIFY_API_SECRET).update(value).digest("base64url");
}

// Short-lived, invoice-scoped capability for browser downloads without bearer headers.
export function documentTicket(shop, customer, invoice) {
  const payload = Buffer.from(JSON.stringify({ shop, customer, invoice: String(invoice), exp: Date.now() + 300000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyDocumentTicket(req, res, next) {
  try {
    const [payload, signature, extra] = String(req.query.ticket || "").split(".");
    const expected = Buffer.from(sign(payload || ""));
    const actual = Buffer.from(signature || "");
    if (extra || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    const id = req.path.split("/").at(-2);
    if (data.exp <= Date.now() || data.invoice !== id) throw new Error();
    req.proxyShop = data.shop;
    req.loggedInCustomerId = data.customer;
    res.set("Referrer-Policy", "no-referrer");
    return next();
  } catch {
    return res.status(401).json({ error: "Download link invalid or expired. Open the invoice again." });
  }
}
