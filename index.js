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
  const toApi = addDays(to, 1);
  const r = await axios.get(`${base}/orden-trabajo/total`, { params: { from, to: toApi } });
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
      const total = await fetchTotal(APIS[sucursal], from, to);
      res.json({ total });
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
        // Un punto por día entre from y to
        let cur = from;
        while (cur <= to) {
          const total = await fetchTotal(base, cur, cur);
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
          const total = await fetchTotal(base, rango.from, rango.to);
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
          const total = await fetchTotal(base, f, t);
          puntos.push({ label: `${y}-${mm}`, total });
        }

      } else if (agrupacion === 'anual') {
        // Un punto por año entre from y to
        const yFrom = parseInt((from || `${new Date().getFullYear() - 2}-01-01`).slice(0, 4));
        const yTo   = parseInt((to   || `${new Date().getFullYear()}-12-31`).slice(0, 4));
        for (let y = yFrom; y <= yTo; y++) {
          const total = await fetchTotal(base, `${y}-01-01`, `${y}-12-31`);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy corriendo en puerto ${PORT}`));
