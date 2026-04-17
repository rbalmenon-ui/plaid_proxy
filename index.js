const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

// CRITICAL: Ensure this matches PROXY_SECRET in your Google Script properties exactly
const PROXY_SECRET = "XXYY1478910AAB"; 

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
    // Handles cases where client_id/secret are inside 'payload' or at the top level
    const plaidClientId = payload?.client_id || req.body.client_id;
    const plaidSecret = payload?.secret || req.body.secret;

    if (!plaidClientId || !plaidSecret) {
      return res.status(400).json({ 
        error: "Missing Credentials", 
        details: "client_id or secret not found in request" 
      });
    }

    // 4. Construct the Final Body for Plaid
    // Plaid requires credentials to be at the TOP level of the JSON body
    const finalPlaidBody = {
      client_id: plaidClientId,
      secret: plaidSecret,
      ...payload
    };

    // 5. Build Dynamic URL (FIXED SYNTAX)
    // Results in: https://plaid.com
    const env = (environment === 'sandbox') ? 'sandbox' : 'production';
    const plaidUrl = `https://${env}://{endpoint}`;

    console.log(`📡 Forwarding to [${env.toUpperCase()}]: ${plaidUrl}`);

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

// Health check endpoint
app.get('/', (req, res) => res.send('Plaid Proxy is live and ready.'));

app.listen(PORT, () => console.log(`Proxy live on port ${PORT}`));
