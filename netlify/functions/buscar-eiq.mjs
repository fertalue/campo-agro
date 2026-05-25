export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
  }
  try {
    const { producto, marca } = await req.json()
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Netlify.env.get('VITE_ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: 'Search the Cornell EIQ database for the EIQ (Environmental Impact Quotient) field value of "' + producto + '"' + (marca ? ' brand ' + marca : '') + '. Return ONLY valid JSON: {"eiq": number_or_null, "fuente": "brief source"}' }]
      })
    })
    const data = await res.json()
    const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
    const match = txt.match(/\{"eiq"[\s\S]*?\}/)
    let result = { eiq: null, fuente: 'No encontrado' }
    if (match) { try { result = JSON.parse(match[0]) } catch {} }
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  } catch (err) {
    return new Response(JSON.stringify({ eiq: null, fuente: 'Error: ' + err.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  }
}
export const config = { path: '/api/buscar-eiq' }