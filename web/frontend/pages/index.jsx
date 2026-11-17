import {useEffect, useState} from "react";
import {Page, Layout, Card, Text, TextContainer, Stack, Badge, List, Banner, Button, Spinner} from "@shopify/polaris";
import {TitleBar, useAppBridge} from "@shopify/app-bridge-react";

export default function HomePage() {
  const bridge = useAppBridge();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function check() {
    setLoading(true); setError("");
    try {
      const token = await bridge.idToken();
      const response = await fetch("/api/setup/status", {headers: {Authorization: `Bearer ${token}`}});
      if (!response.ok) throw new Error("Setup check failed. Check DATABASE_URL and restart the app.");
      setStatus(await response.json());
    } catch (err) { setError(err.message || "Unable to check setup."); }
    finally { setLoading(false); }
  }
  useEffect(() => { check(); }, []);
  return <Page>
    <TitleBar title="Account invoices" />
    <Layout>
      <Layout.Section>
        <Card sectioned>
          <TextContainer>
            <Text as="h1" variant="headingLg">Customer account invoices</Text>
            <Text as="p">Customers can view their invoices and download PDFs in English and French. Invoice data and documents are supplied by this app.</Text>
          </TextContainer>
        </Card>
      </Layout.Section>
      <Layout.Section>
        <Card title="Enable the Invoices page" sectioned>
          <TextContainer>
            <Banner status="info">Installing the app does not automatically add Invoices to your customer account menu.</Banner>
            <List type="number">
              <List.Item>Use Shopify customer accounts. The extension does not appear in legacy customer accounts.</List.Item>
              <List.Item>Release this app's customer-invoices extension with npm run deploy. For local testing, run npm run dev and use Shopify's extension preview.</List.Item>
              <List.Item>Open Settings → Customer accounts → Customize to open the checkout and accounts editor.</List.Item>
              <List.Item>Open Apps, find Invoices under this app, and add the page. Choose Add to menu, then save the account configuration.</List.Item>
              <List.Item>Sign in as a customer and open Invoices. The table shows invoices ingested for that customer's Shopify ID.</List.Item>
              <List.Item>Enable this app's protected customer data access in the developer dashboard so Shopify supplies the signed-in customer identity.</List.Item>
            </List>
            {status && <Button url={status.customer_accounts_settings_url} external>Open customer account settings</Button>}
            <Text as="p" color="subdued">If Invoices is missing from Apps, confirm the extension is released on the same Shopify app installed on this store. No theme or Liquid changes are needed.</Text>
          </TextContainer>
        </Card>
      </Layout.Section>
      <Layout.Section>
        <Card title="Connection and saved tokens" sectioned>
          <TextContainer>
            {loading && <Spinner accessibilityLabel="Checking setup" size="small" />}
            {error && <Banner status="critical">{error}</Banner>}
            {status && <>
              <Stack><Badge status="success">Database connected</Badge><Badge status={status.access_token_saved ? "success" : "warning"}>{status.access_token_saved ? "OAuth token saved" : "Open app again to authorize"}</Badge></Stack>
              <Text as="p">Store: {status.shop}</Text>
              <Text as="p">Storage: {status.session_storage}. Saved sessions: {status.sessions_saved}. Stored invoices: {status.invoices}.</Text>
              <Text as="p">App URL: {status.app_url}</Text>
              {!status.invoice_shop_matches && <Banner status="warning">INVOICE_SHOP_DOMAIN differs from this store. Update it in .env, or send the correct X-Shopify-Shop-Domain with ERP requests.</Banner>}
              {!status.ingest_secret_configured && <Banner status="warning">Set INVOICE_INGEST_SECRET in .env before connecting your ERP.</Banner>}
              <Text as="p" color="subdued">OAuth access tokens are saved automatically on the server in PostgreSQL. Customer session tokens are short lived and verified on each request. Secrets are never shown here.</Text>
            </>}
            <Button onClick={check} loading={loading}>Refresh status</Button>
          </TextContainer>
        </Card>
      </Layout.Section>
      <Layout.Section oneHalf>
        <Card title="Configuration" sectioned>
          <TextContainer>
            <Text as="p">Set DATABASE_URL, INVOICE_SHOP_DOMAIN, INVOICE_INGEST_SECRET, and company details in .env. Restart after changing server settings.</Text>
            <Text as="p">The public app URL and client ID default to shopify.app.toml. Set SHOPIFY_APP_URL to override the URL. Shopify CLI supplies its tunnel URL and credentials during development.</Text>
            <Text as="p">For production, set SHOPIFY_API_SECRET in the hosting environment and release the extension again after changing its backend URL.</Text>
            <Text as="p">The extension connects through the store's app proxy automatically. Password-protected development stores use the generated backend URL as a fallback. No URL is required in the account editor.</Text>
          </TextContainer>
        </Card>
      </Layout.Section>
      <Layout.Section oneHalf>
        <Card title="ERP connection" sectioned>
          <TextContainer>
            <Text as="p">POST /api/invoices/ingest</Text>
            <Text as="p">POST /api/outstanding/ingest</Text>
            <Text as="p">Headers: X-Invoice-Secret and X-Shopify-Shop-Domain. Invoice records must include the customer's Shopify ID.</Text>
            <Text as="p">Existing invoice APIs remain available. Use npm run check:setup to check storage without exposing tokens.</Text>
          </TextContainer>
        </Card>
      </Layout.Section>
    </Layout>
  </Page>;
}
