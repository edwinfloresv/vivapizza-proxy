const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const API_BASE = 'https://api-vivapizza-armenia.ajkcloud.work';

app.get('/orden-trabajo/total', async (req, res) => {
  try {
    const { from, to } = req.query;
    const response = await axios.get(`${API_BASE}/orden-trabajo/total`, {
      params: { from, to }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Error consultando la API' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy corriendo en puerto ${PORT}`));
