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
  const incomingKey = req.headers['x-proxy-auth'];
  if (incomingKey !== PROXY_SECRET) return res.status(401).send("Unauthorized");

  const { ticker, exchange } = req.body;
  const symbol = ticker.toLowerCase();

  // 1. HARDCODED STOCKS (Instant response, no scraping)
  const stockSectors = {
    'msft': { usStock: 100, technology: 100, giant: 100 },
    'aapl': { usStock: 100, technology: 100, giant: 100 },
    'googl': { usStock: 100, communicationServices: 100, giant: 100 },
    'amzn': { usStock: 100, consumerCyclical: 100, giant: 100 }
  };

  if (stockSectors[symbol]) {
    const s = stockSectors[symbol];
    return res.json({ portfolio: { 
      assetAllocation: { usStock: s.usStock }, 
      sector: { [Object.keys(s)[1]]: 100 }, 
      marketCap: { [Object.keys(s)[2]]: 100 } 
    }});
  }

  // 2. ETF SCRAPING
  try {
    const exch = exchange || 'arcx';
    const url = `https://www.morningstar.com/etfs/${exch}/${symbol}/portfolio`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      }
    });

    const html = response.data;
    
    // NEW 2026 REGEX: More flexible to catch the data even if Morningstar moves it
    const jsonMatch = html.match(/\{"portfolio":\{[\s\S]*?\}\}(?=;|<\/script>)/) || 
                      html.match(/\{"assetAllocation":[\s\S]*?\}\}(?=;|<\/script>)/);

    if (!jsonMatch) {
      console.error(`❌ Data Structure Change detected for ${symbol}`);
      return res.status(500).json({ error: "Structure Error", details: "Could not find portfolio JSON" });
    }

    // Return the specific JSON chunk back to Google
    res.send(jsonMatch[0]);

  } catch (error) {
    res.status(500).json({ error: "Fetch Failed", details: error.message });
  }
});

// Health check endpoint
app.get('/', (req, res) => res.send('Proxy is live. Plaid and Morningstar routes are active.'));

app.listen(PORT, () => console.log(`Proxy live on port ${PORT}`));
