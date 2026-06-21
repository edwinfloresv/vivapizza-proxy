const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const APIS = {
  armenia: 'https://api-vivapizza-armenia.ajkcloud.work',
  izalco:  'https://api-vivapizza-izalco.ajkcloud.work',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function fetchTotal(base, from, to) {
  // 'to' ya viene con +1 día aplicado desde el panel o desde el agrupador interno
  const r = await axios.get(`${base}/orden-trabajo/total`, { params: { from, to } });
  return r.data.total ?? 0;
}

function isoWeek(iso) {
  const d = new Date(iso + 'T12:00:00');
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const diff = (d - jan4) / 86400000;
  return `${d.getFullYear()}-W${String(Math.ceil((diff + jan4.getDay() + 1) / 7)).padStart(2, '0')}`;
}

// ── Simple total endpoints ─────────────────────────────────────────────────
function makeTotalRoute(sucursal) {
  return async (req, res) => {
    try {
      const { from, to } = req.query;
      // 'to' ya viene con +1 día desde el panel (rango exclusivo)
      const r = await axios.get(`${APIS[sucursal]}/orden-trabajo/total`, { params: { from, to } });
      res.json({ total: r.data.total ?? 0 });
    } catch (e) {
      res.status(500).json({ error: `Error consultando ${sucursal}` });
    }
  };
}

app.get('/armenia/orden-trabajo/total', makeTotalRoute('armenia'));
app.get('/izalco/orden-trabajo/total',  makeTotalRoute('izalco'));

// Legacy
app.get('/orden-trabajo/total', makeTotalRoute('armenia'));

// ── Ventas agrupadas ───────────────────────────────────────────────────────
function makeVentasRoute(sucursal) {
  return async (req, res) => {
    const { agrupacion, from, to, year } = req.query;
    const base = APIS[sucursal];

    try {
      let puntos = [];

      if (agrupacion === 'diario') {
        let cur = from;
        while (cur <= to) {
          const total = await fetchTotal(base, cur, addDays(cur, 1));
          puntos.push({ label: cur, total });
          cur = addDays(cur, 1);
        }

      } else if (agrupacion === 'semanal') {
        // Agrupar días en semanas
        let cur = from;
        const semanas = {};
        while (cur <= to) {
          const semana = isoWeek(cur);
          if (!semanas[semana]) semanas[semana] = { from: cur, to: cur };
          else semanas[semana].to = cur;
          cur = addDays(cur, 1);
        }
        for (const [semana, rango] of Object.entries(semanas)) {
          const total = await fetchTotal(base, rango.from, addDays(rango.to, 1));
          puntos.push({ label: semana, total });
        }

      } else if (agrupacion === 'mensual') {
        // 12 meses del año indicado (o rango from/to)
        const y = year || new Date().getFullYear();
        for (let m = 1; m <= 12; m++) {
          const mm = String(m).padStart(2, '0');
          const lastDay = new Date(y, m, 0).getDate();
          const f = `${y}-${mm}-01`;
          const t = `${y}-${mm}-${lastDay}`;
          const total = await fetchTotal(base, f, addDays(t, 1));
          puntos.push({ label: `${y}-${mm}`, total });
        }

      } else if (agrupacion === 'anual') {
        // Un punto por año entre from y to
        const yFrom = parseInt((from || `${new Date().getFullYear() - 2}-01-01`).slice(0, 4));
        const yTo   = parseInt((to   || `${new Date().getFullYear()}-12-31`).slice(0, 4));
        for (let y = yFrom; y <= yTo; y++) {
          const total = await fetchTotal(base, `${y}-01-01`, `${y+1}-01-01`);
          puntos.push({ label: `${y}`, total });
        }
      } else {
        return res.status(400).json({ error: 'agrupacion inválida. Usa: diario, semanal, mensual, anual' });
      }

      res.json({ sucursal, agrupacion, puntos });
    } catch (e) {
      console.error(e.message);
      res.status(500).json({ error: `Error consultando ${sucursal}: ${e.message}` });
    }
  };
}

app.get('/armenia/ventas', makeVentasRoute('armenia'));
app.get('/izalco/ventas',  makeVentasRoute('izalco'));

// ── Lista de órdenes ───────────────────────────────────────────────────────
function makeListaRoute(sucursal) {
  return async (req, res) => {
    try {
      const { from, to } = req.query;
      const r = await axios.get(`${APIS[sucursal]}/orden-trabajo/lista`, { params: { from, to } });
      res.json(r.data);
    } catch (e) {
      res.status(500).json({ error: `Error consultando lista ${sucursal}: ${e.message}` });
    }
  };
}

app.get('/armenia/orden-trabajo/lista', makeListaRoute('armenia'));
app.get('/izalco/orden-trabajo/lista',  makeListaRoute('izalco'));

// ── Análisis IA ────────────────────────────────────────────────────────────
app.post('/ia/analisis-tipos', express.json(), async (req, res) => {
  try {
    const { sucursal, periodo, totalCantidad, totalMonto, resumen } = req.body;

    const prompt = `Eres un analista de negocio experto en restaurantes y pizzerías. Analiza estos datos de ventas de Viva Pizza sucursal ${sucursal} para el período ${periodo}:

Total de órdenes: ${totalCantidad}
Monto total: ${totalMonto}

Desglose por tipo de orden:
${resumen}

Escribe un análisis breve (3-4 párrafos) en español con:
1. Qué tipo de orden domina y qué significa para el negocio
2. Oportunidades o alertas que ves en la distribución
3. Una recomendación concreta para el dueño

Sé directo, práctico y enfocado en acciones. No uses bullet points, escribe en párrafos.`;

    const iaRes = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });

    const texto = iaRes.data.content?.[0]?.text || 'No se pudo generar el análisis.';
    res.json({ texto });
  } catch (e) {
    console.error('IA error:', e.message);
    res.status(500).json({ error: 'Error generando análisis: ' + e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy corriendo en puerto ${PORT}`));
