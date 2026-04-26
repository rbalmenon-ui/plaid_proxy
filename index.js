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
  const { ticker } = req.body;
  const authHeader = req.headers['x-proxy-auth'];
  if (authHeader !== PROXY_SECRET) return res.status(401).send("Unauthorized");

  console.log(`📡 Fetching API for: ${ticker}`);

  try {
    // 2026 MOBILE API ENDPOINT: Bypasses the HTML shield
    const apiUrl = `https://api-global.morningstar.com/sal-service/v1/etf/portfolio/v2/${ticker.toLowerCase()}/data`;
    
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Morningstar/2.5.0 (iPhone; iOS 17.4; Scale/3.00)',
        'Accept': 'application/json',
        'x-api-key': '05943f54-52d8-4f81-9b1d-72013f9f74a8', // Current 2026 Public Key
        'Origin': 'https://www.morningstar.com'
      },
      timeout: 10000
    });

    // The API returns pure JSON - much safer!
    res.json(response.data);

  } catch (error) {
    console.error(`❌ API Fail: ${error.message}`);
    // If API fails, send a specific error code back to Google
    res.status(502).json({ error: "Provider IP Blocked", msg: error.message });
  }
});

// CRITICAL: Add this to the bottom of your file to prevent Render from killing the connection early
const server = app.listen(PORT, () => console.log(`Proxy live on port ${PORT}`));
server.keepAliveTimeout = 120000; // 120 seconds
server.headersTimeout = 125000;

// Health check endpoint
app.get('/', (req, res) => res.send('Proxy is live. Plaid and Morningstar routes are active.'));

app.listen(PORT, () => console.log(`Proxy live on port ${PORT}`));
