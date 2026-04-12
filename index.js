const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Render provides the PORT dynamically
const PORT = process.env.PORT || 3000;

// This matches the 'X-Proxy-Auth' header in your Google Script
const PROXY_SECRET = "XXYY1478910AAB"; 

app.post('/plaid-proxy', async (req, res) => {
  console.log("--- New Request Received ---");

  // 1. Security Check: Block anyone who doesn't have your password
  const incomingKey = req.headers['x-proxy-auth'];
  if (incomingKey !== PROXY_SECRET) {
    console.error("❌ Unauthorized attempt blocked.");
    return res.status(401).json({ error: "Unauthorized access" });
  }

  try {
    const { endpoint, payload } = req.body;
    console.log(`Forwarding request to Plaid endpoint: ${endpoint}`);

    // 2. Forward request to Plaid using string concatenation (safest for Windows)
    const plaidUrl = "https://sandbox.plaid.com/" + endpoint;
    const response = await axios.post(plaidUrl, payload);

    console.log("✅ Plaid API Success!");
    res.json(response.data);

  } catch (error) {
    // 3. Detailed Error Logging
    const errorDetail = error.response?.data || error.message;
    console.error("❌ Plaid API Error:", JSON.stringify(errorDetail));

    res.status(error.response?.status || 500).json({
      error: 'Plaid API Error',
      details: errorDetail
    });
  }
});

// Basic health check for your browser
app.get('/', (req, res) => {
  res.send('Plaid Proxy is running and secure.');
});

app.listen(PORT, () => console.log(`Proxy live on port ${PORT}`));
