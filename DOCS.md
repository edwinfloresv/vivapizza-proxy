# vivapizza-proxy — Documentación técnica

## Descripción
Servidor proxy Node.js/Express desplegado en Render que actúa como intermediario entre el panel web (`vivapizza-panel`) y las APIs privadas de cada sucursal de Viva Pizza. Su función principal es evitar problemas de CORS y centralizar el acceso a las dos APIs de sucursal.

## Tecnologías
- **Node.js** con **Express 4**
- **Axios** para llamadas HTTP a las APIs de sucursal
- **CORS** habilitado para permitir peticiones desde el panel web
- Desplegado en **Render** (plan gratuito, puede tardar ~1 min en despertar)

## APIs de sucursal
| Sucursal | Base URL |
|----------|----------|
| Armenia  | `https://api-vivapizza-armenia.ajkcloud.work` |
| Izalco   | `https://api-vivapizza-izalco.ajkcloud.work`  |

Ambas APIs exponen el endpoint `/orden-trabajo/total?from=YYYY-MM-DD&to=YYYY-MM-DD` que devuelve `{ total: number }`.

## Endpoints expuestos

### Totales simples
```
GET /armenia/orden-trabajo/total?from=YYYY-MM-DD&to=YYYY-MM-DD
GET /izalco/orden-trabajo/total?from=YYYY-MM-DD&to=YYYY-MM-DD
GET /orden-trabajo/total?from=YYYY-MM-DD&to=YYYY-MM-DD   ← legacy Armenia
```
Devuelve: `{ total: number }`

> **Nota importante:** El parámetro `to` que recibe el proxy ya viene con +1 día aplicado desde el panel, para que el rango sea inclusivo en la API de sucursal.

### Ventas agrupadas
```
GET /armenia/ventas?agrupacion=diario&from=YYYY-MM-DD&to=YYYY-MM-DD
GET /izalco/ventas?agrupacion=diario&from=YYYY-MM-DD&to=YYYY-MM-DD
```

**Parámetros:**
| Parámetro   | Valores posibles                  | Notas                              |
|-------------|-----------------------------------|------------------------------------|
| `agrupacion`| `diario`, `semanal`, `mensual`, `anual` | Requerido                    |
| `from`      | `YYYY-MM-DD`                      | Requerido para diario y semanal    |
| `to`        | `YYYY-MM-DD`                      | Requerido para diario y semanal    |
| `year`      | `YYYY`                            | Requerido para mensual             |

**Devuelve:**
```json
{
  "sucursal": "armenia",
  "agrupacion": "diario",
  "puntos": [
    { "label": "2026-06-01", "total": 345.50 },
    { "label": "2026-06-02", "total": 412.00 }
  ]
}
```

**Cómo funciona internamente:** El proxy no tiene base de datos. Por cada punto del agrupado, hace una llamada individual al endpoint `/orden-trabajo/total` de la API de sucursal. Por ejemplo, para 30 días diarios hace 30 llamadas secuenciales. Para agrupación semanal agrupa los días en semanas ISO y hace una llamada por semana.

## Relación con vivapizza-panel
El panel consume este proxy directamente desde el navegador. Sin el proxy, el navegador no podría llamar a las APIs de sucursal por restricciones CORS.

```
Navegador (vivapizza-panel)
        │
        │ fetch()
        ▼
vivapizza-proxy (Render)
        │
        │ axios.get()
        ├──► api-vivapizza-armenia.ajkcloud.work
        └──► api-vivapizza-izalco.ajkcloud.work
```

## Despliegue
- Repositorio: `edwinfloresv/vivapizza-proxy`
- URL producción: `https://vivapizza-proxy.onrender.com`
- Render redespliega automáticamente en cada push a `main`
- Variables de entorno: ninguna requerida (URLs de API hardcodeadas)
- Puerto: `process.env.PORT || 3000`

## Instalación local
```bash
npm install
node index.js
# Proxy disponible en http://localhost:3000
```
