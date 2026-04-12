const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// Render provides the PORT dynamically
const PORT = process.env.PORT || 3000;

app.post('/plaid-proxy', async (req, res) => {
  try {
    const { endpoint, payload } = req.body;
    // Forwards request to Plaid from a clean, non-Google IP
    const response = await axios.post(`https://plaid.com{endpoint}`, payload);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Proxy Error' });
  }
});

app.listen(PORT, () => console.log(`Proxy live on port ${PORT}`));
