const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const PROXY_SECRET = "XXYY1478910AAB"; 

app.post('/plaid-proxy', async (req, res) => {
  const incomingKey = req.headers['x-proxy-auth'];
  if (incomingKey !== PROXY_SECRET) {
    console.error("❌ Auth Failed: Incoming Key does not match PROXY_SECRET");
    return res.status(401).json({ error: "Unauthorized access" });
  }

  try {
    // 1. Log exactly what we received from Google
    console.log("--- New Request Received ---");
    console.log("Full Body Keys:", Object.keys(req.body));
    
    const { endpoint, payload, environment } = req.body;

    // 2. Strict Extraction
    // We try to pull from the nested 'payload' first, then the root 'body'
    const finalClientId = payload?.client_id || req.body.client_id;
    const finalSecret = payload?.secret || req.body.secret;

    // 3. INTERNAL LOGGING (Safe)
    // We log only the length and existence to protect your keys
    console.log(`Endpoint: ${endpoint}`);
    console.log(`Env: ${environment}`);
    console.log(`ClientID Length: ${finalClientId ? finalClientId.length : '0 (EMPTY!)'}`);
    console.log(`Secret Length: ${finalSecret ? finalSecret.length : '0 (EMPTY!)'}`);

    if (!finalClientId || finalClientId.length < 5) {
      console.error("❌ FAIL: client_id is empty or too short!");
      return res.status(400).json({ error: "client_id must be a non-empty string" });
    }

    // 4. Construct the Final Body Plaid expects
    const plaidBody = {
      client_id: finalClientId,
      secret: finalSecret,
      ...payload // This spreads everything else (user_id, products, etc.)
    };

    const env = (environment === 'sandbox') ? 'sandbox' : 'production';
    const plaidUrl = `https://${env}://{endpoint}`;

    // 5. Send to Plaid
    const response = await axios.post(plaidUrl, plaidBody);
    console.log("✅ Plaid Response: 200 OK");
    res.json(response.data);

  } catch (error) {
    const errorData = error.response?.data || { message: error.message };
    console.error("❌ Plaid API Error Detail:", JSON.stringify(errorData));
    res.status(error.response?.status || 500).json({ error: 'Plaid API Error', details: errorData });
  }
});

app.get('/', (req, res) => res.send('Proxy Live'));
app.listen(PORT, () => console.log(`Proxy listening on port ${PORT}`));


// Health check endpoint
app.get('/', (req, res) => res.send('Plaid Proxy is live and ready.'));

app.listen(PORT, () => console.log(`Proxy live on port ${PORT}`));
