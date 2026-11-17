import { Router } from "express";
import { appProxyAuth, appProxySignature } from "../middleware/app-proxy-auth.js";
import { customerAccountAuth } from "../middleware/customer-account-auth.js";
import { documentTicket, verifyDocumentTicket } from "../services/document-ticket.js";
import { streamInvoicePdf } from "../services/invoice-pdf.js";
import { getCompanyBlock } from "../services/company.js";
import {
  getInvoiceForCustomer,
  getUnpaidStatement,
  listLatestInvoices,
  normalizeShopifyId,
} from "../services/invoices.js";
import {
  attachOutstandingToInvoices,
  resolveOutstandingForCustomer,
} from "../services/outstanding.js";

const router = Router();

async function accountAuthentication(req, res, next) {
  if (/^\/customer\/invoices\/[a-z0-9-]+\/pdf$/i.test(req.path)) {
    return verifyDocumentTicket(req, res, () => {
      if (req.signedProxyShop && req.signedProxyShop !== req.proxyShop) {
        return res.status(401).json({ error: "Download shop does not match proxy shop" });
      }
      return next();
    });
  }
  return customerAccountAuth(req, res, next);
}

router.use((req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  if (req.baseUrl === "/api/customer-account" || req.baseUrl === "/api/proxy/account") {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    if (req.baseUrl === "/api/proxy/account") return appProxySignature(req, res, () => accountAuthentication(req, res, next));
    return accountAuthentication(req, res, next);
  }
  return appProxyAuth(req, res, next);
});

router.get("/customer/invoices/:id/pdf", async (req, res) => {
  try {
    const invoice = await getInvoiceForCustomer(req.proxyShop, req.loggedInCustomerId, req.params.id);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (!invoice.downloadable) return res.status(422).json({ error: "Missing required totals" });
    return streamInvoicePdf(res, { ...invoice, company: getCompanyBlock() }, req.query.lang);
  } catch (err) {
    console.error("[invoice pdf]", err);
    if (!res.headersSent) return res.status(500).json({ error: "Failed to generate PDF" });
    res.end();
  }
});

router.get("/customer/invoices", async (req, res) => {
  try {
    const shop = req.proxyShop;
    const customerId = normalizeShopifyId(req.loggedInCustomerId);

    const list = await listLatestInvoices(shop, customerId, {
      page: req.query.page,
      page_size: req.query.page_size,
      q: req.query.q,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      balance: req.query.balance,
    });

    const outstanding = await resolveOutstandingForCustomer(shop, customerId);
    const data = attachOutstandingToInvoices(list.data);

    return res
      .status(200)
      .set("Content-Type", "application/json")
      .json({
        data,
        meta: {
          ...list.meta,
          outstanding_balance: outstanding.customer_outstanding,
          outstanding_currency: outstanding.currency,
          outstanding_mode: outstanding.mode,
        },
      });
  } catch (err) {
    console.error("[customer-invoices list]", err);
    return res.status(500).json({ error: "Failed to load invoices" });
  }
});

router.get("/customer/invoices/statement", async (req, res) => {
  try {
    const invoices = await getUnpaidStatement(
      req.proxyShop, normalizeShopifyId(req.loggedInCustomerId)
    );
    return res.set("Cache-Control", "private, no-store").json({
      data: { invoices, company: getCompanyBlock(), generated_at: new Date().toISOString() },
    });
  } catch (err) {
    console.error("[customer-invoices statement]", err);
    return res.status(500).json({ error: "Failed to load statement" });
  }
});

router.get("/customer/invoices/:id", async (req, res) => {
  try {
    const shop = req.proxyShop;
    const customerId = normalizeShopifyId(req.loggedInCustomerId);
    const invoice = await getInvoiceForCustomer(
      shop,
      customerId,
      req.params.id
    );

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Never offer download when required totals are missing (brief 4.1 / AC12)
    if (req.query.download === "1" && !invoice.downloadable) {
      return res.status(422).json({
        error: "Invoice is missing required totals and cannot be downloaded",
        downloadable: false,
      });
    }

    const company = getCompanyBlock();
    if (!company.tax_registration_no && invoice.tax_registration_no) {
      company.tax_registration_no = invoice.tax_registration_no;
    }

    return res.status(200).json({
      data: {
        ...invoice,
        company,
        ...(["/api/customer-account", "/api/proxy/account"].includes(req.baseUrl) && invoice.downloadable
          ? { pdf_path: `/customer/invoices/${invoice.id}/pdf?ticket=${documentTicket(req.proxyShop, customerId, invoice.id)}` }
          : {}),
      },
    });
  } catch (err) {
    console.error("[customer-invoices detail]", err);
    return res.status(500).json({ error: "Failed to load invoice" });
  }
});

export default router;
