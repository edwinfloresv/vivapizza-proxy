const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const APIS = {
  armenia: 'https://api-vivapizza-armenia.ajkcloud.work',
  izalco:  'https://api-vivapizza-izalco.ajkcloud.work',
};

// Armenia
app.get('/armenia/orden-trabajo/total', async (req, res) => {
  try {
    const { from, to } = req.query;
    const response = await axios.get(`${APIS.armenia}/orden-trabajo/total`, { params: { from, to } });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Error consultando Armenia' });
  }
});

// Izalco
app.get('/izalco/orden-trabajo/total', async (req, res) => {
  try {
    const { from, to } = req.query;
    const response = await axios.get(`${APIS.izalco}/orden-trabajo/total`, { params: { from, to } });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Error consultando Izalco' });
  }
});

// Legacy — mantiene compatibilidad con el endpoint anterior
app.get('/orden-trabajo/total', async (req, res) => {
  try {
    const { from, to } = req.query;
    const response = await axios.get(`${APIS.armenia}/orden-trabajo/total`, { params: { from, to } });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Error consultando la API' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy corriendo en puerto ${PORT}`));
