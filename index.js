const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

// CRITICAL: Ensure this matches PROXY_SECRET in your Google Script properties exactly
const PROXY_SECRET = "XXYY1478910AAB"; 

/**
 * PATH 1: PLAID PROXY
 * Handles authentication and forwarding for Plaid API calls
 */
app.post('/plaid-proxy', async (req, res) => {
  const incomingKey = req.headers['x-proxy-auth'];
  
  // 1. Security Check
  if (incomingKey !== PROXY_SECRET) {
    console.error("❌ Unauthorized: Proxy Secret Mismatch");
    return res.status(401).json({ error: "Unauthorized access" });
  }

  try {
    // 2. Destructure the wrapper from Google Apps Script
    const { endpoint, payload, environment } = req.body;

    // 3. Extract Credentials
    const plaidClientId = payload?.client_id || req.body.client_id;
    const plaidSecret = payload?.secret || req.body.secret;

    if (!plaidClientId || !plaidSecret) {
      return res.status(400).json({ 
        error: "Missing Credentials", 
        details: "client_id or secret not found in request" 
      });
    }

    // 4. Construct the Final Body for Plaid
    const finalPlaidBody = {
      client_id: plaidClientId,
      secret: plaidSecret,
      ...payload
    };

    // 5. Build Dynamic URL
    const env = (environment === 'sandbox') ? 'sandbox' : 'production';
    const plaidUrl = "https://" + env + ".plaid.com/" + endpoint;

    console.log(`📡 Forwarding Plaid to [${env.toUpperCase()}]: ${plaidUrl}`);

    // 6. Execute Request to Plaid
    const response = await axios.post(plaidUrl, finalPlaidBody, {
      headers: { 'Content-Type': 'application/json' }
    });

    res.json(response.data);

  } catch (error) {
    const errorStatus = error.response?.status || 500;
    const errorData = error.response?.data || { message: error.message };
    console.error("❌ Plaid API Error:", JSON.stringify(errorData));
    res.status(errorStatus).json({ 
      error: 'Plaid API Error', 
      details: errorData 
    });
  }
});

/**
 * PATH 2: MORNINGSTAR PROXY (SCRAPER)
 * Fetches HTML from Morningstar to bypass Google Sheets IP blocking
 */
app.post('/morningstar-proxy', async (req, res) => {
  const authHeader = req.headers['x-proxy-auth'];
  if (authHeader !== PROXY_SECRET) return res.status(401).send("Unauthorized");

  const { ticker } = req.body;
  console.log(`🚀 Skyfall-Scraping: ${ticker}`);

  try {
    const url = `https://www.morningstar.com/etfs/arcx/${ticker.toLowerCase()}/portfolio`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0' },
      timeout: 15000 
    });

    const html = response.data;
    
    // 2026 SKYFALL REGEX: Optimized for the new preloadedState structure
    const regex = /\{"portfolioSummary":[\s\S]*?\}\}(?=;|<\/script>)/;
    const match = html.match(regex);

    if (!match) {
      // Fallback for stocks vs ETFs
      const altRegex = /\{"assetAllocation":[\s\S]*?\}\}(?=;|<\/script>)/;
      const altMatch = html.match(altRegex);
      if (!altMatch) throw new Error("Portfolio block not found");
      return res.send(altMatch[0]);
    }

    res.send(match[0]);
  } catch (error) {
    console.error(`❌ MS Fail: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});
// CRITICAL: Add this to the bottom of your file to prevent Render from killing the connection early
const server = app.listen(PORT, () => console.log(`Proxy live on port ${PORT}`));
server.keepAliveTimeout = 120000; // 120 seconds
server.headersTimeout = 125000;

// Health check endpoint
app.get('/', (req, res) => res.send('Proxy is live. Plaid and Morningstar routes are active.'));

app.listen(PORT, () => console.log(`Proxy live on port ${PORT}`));
