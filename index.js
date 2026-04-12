const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/plaid-proxy', async (req, res) => {
  console.log("--- New Request Received ---");
  console.log("Endpoint:", req.body.endpoint);
  
  try {
    const { endpoint, payload } = req.body;
    
    // Forwards to Plaid
    const response = await axios.post(`https://plaid.com{endpoint}`, payload);
    
    console.log("✅ Plaid Success!");
    res.json(response.data);
  } catch (error) {
    // This logs the EXACT Plaid error to your Render dashboard
    const errorDetail = error.response?.data || error.message;
    console.error("❌ Proxy Error Detail:", JSON.stringify(errorDetail));
    
    res.status(error.response?.status || 500).json({
      error: 'Plaid API Error',
      details: errorDetail
    });
  }
});

app.listen(PORT, () => console.log(`Proxy live on port ${PORT}`));
