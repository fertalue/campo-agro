export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { base64, mediaType } = await req.json()

    // PDFs se envían como "document", imágenes como "image"
    const isPDF = mediaType === 'application/pdf'
    const contentBlock = isPDF
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image',    source: { type: 'base64', media_type: mediaType,          data: base64 } }

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
            contentBlock,
            { type: 'text', text: `Analizá esta factura argentina y respondé SOLO con JSON válido (sin markdown), con estos campos exactos:
{
  "proveedor": "nombre del proveedor",
  "fecha": "YYYY-MM-DD",
  "factura_numero": "número de factura o tique",
  "producto_servicio": "descripción del producto o servicio principal",
  "precio_unitario": número o null,
  "cantidad": número o null,
  "moneda": "ARS" o "USD oficial",
  "iva_pct": 0 o 0.105 o 0.21,
  "iva_incluido": true o false,
  "monto_total_factura": número total de la factura sin puntos de miles (ej: 315866.18),
  "iva_total": número total del IVA o null,
  "otros_impuestos_total": número de otros impuestos o null,
  "tiene_items_no_campo": true o false,
  "comentarios": "observación breve si hay algo relevante" o null
}

REGLAS CRÍTICAS:
- Las facturas son de Argentina, el año SIEMPRE es 2024, 2025 o 2026. NUNCA uses 2020, 2021, 2022, 2023.
- El formato de fecha en facturas argentinas es DD/MM/YYYY. Ejemplo: "09/04/2026" → fecha: "2026-04-09".
- Si ves "09/04/26" o "09/04/2026", la fecha es 2026-04-09, NO 2020-04-09.
- Los números en Argentina usan punto como separador de miles y coma para decimales. Ejemplo: "315.866,18" → 315866.18.
- Si hay múltiples productos (ej: combustible), en producto_servicio escribí el primero o el más importante.
- monto_total_factura es el TOTAL final de la factura (lo que se paga).` }
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
