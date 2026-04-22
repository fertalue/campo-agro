export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const { base64, mediaType } = await req.json()

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
            { type: 'text', text: `Esta es una Carta de Porte Electrónica (CPE) argentina. Extraé los datos y respondé SOLO con JSON válido (sin markdown ni backticks):
{
  "titular": "nombre normalizado del Titular Carta de Porte (ver reglas de normalización abajo)",
  "ncp": "número de CPE completo con guión (ej: 07878-00000025)",
  "ctg": "número de CTG",
  "fecha": "YYYY-MM-DD (convertir de DD/MM/YYYY del documento)",
  "campanha": "campaña en formato XX-XX (ej: 2526 → 25-26)",
  "grano": "Maíz, Soja, Soja semilla, Trigo o Girasol",
  "comprador": "nombre del Destinatario (sin CUIT)",
  "flete_pagador": "nombre del Flete pagador (sin CUIT)",
  "patente": "dominios separados por guión (ej: ABC123-DEF456)",
  "bruto": número entero kg bruto o null,
  "tara": número entero kg tara o null,
  "neto": número entero kg neto (Peso Neto) o null,
  "transporte": "nombre del chofer o empresa transportista (sin CUIT)"
}

REGLAS CRÍTICAS:
- "titular" = campo "Titular Carta de Porte", NO el remitente ni productor
- "comprador" = campo "Destinatario"
- "campanha": el campo dice "2526" → escribir "25-26"; "2425" → "24-25"
- Fechas: DD/MM/YYYY del documento → YYYY-MM-DD. El año es siempre 2024, 2025 o 2026
- Sin CUIT, solo el nombre de la empresa o persona
- "patente" = campo Dominios del transporte

NORMALIZACIÓN DE TITULARES (aplicar siempre):
- Si el titular contiene "FERNANDO", "Fernando" o "ROSSI FERNANDO" → escribir exactamente "Fer"
- Si el titular contiene "LEONARDO", "Leonardo", "JUAN LEONARDO" o "ROSSI JUAN" → escribir exactamente "Leo"
- Si el titular contiene "DARIO", "Darío", "ROSSI DARIO" → escribir exactamente "Dari"
- Para cualquier otro titular, usar solo el nombre sin CUIT` }
          ]
        }]
      })
    })

    const data = await resp.json()
    if (!resp.ok) return new Response(JSON.stringify({ error: data }), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export const config = { path: '/api/analizar-carta-porte' }
