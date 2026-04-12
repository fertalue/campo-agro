export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { base64, mediaType } = await req.json()

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: `Analizá esta factura y respondé SOLO con JSON válido (sin markdown), con estos campos exactos:
{
  "proveedor": "nombre del proveedor",
  "fecha": "YYYY-MM-DD",
  "factura_numero": "número de factura",
  "producto_servicio": "descripción del producto o servicio principal",
  "precio_unitario": número o null,
  "cantidad": número o null,
  "moneda": "ARS" o "USD oficial",
  "iva_pct": 0 o 0.105 o 0.21,
  "iva_incluido": true o false,
  "monto_total_factura": número total de la factura,
  "iva_total": número total del IVA o null,
  "otros_impuestos_total": número de otros impuestos o null,
  "tiene_items_no_campo": true o false,
  "comentarios": "observación breve si hay algo relevante" o null
}` }
          ]
        }]
      })
    })

    const data = await resp.json()
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: data }), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const config = { path: '/api/analizar-factura' }
