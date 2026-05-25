export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }

  try {
    const { producto, marca } = await req.json()

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Netlify.env.get('VITE_ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `What is the EIQ (Environmental Impact Quotient) field value for the pesticide active ingredient "${producto}"${marca ? ' (brand: ' + marca + ')' : ''}? The EIQ is calculated by Cornell University. Respond ONLY with valid JSON, no extra text: {"eiq": number_or_null, "fuente": "brief reference"}. If uncertain or unknown, use null for eiq.`
        }]
      })
    })

    const data = await res.json()
    const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
    const match = txt.match(/\{[\s\S]*?"eiq"[\s\S]*?\}/)
    let result = { eiq: null, fuente: 'No encontrado' }
    if (match) {
      try { result = JSON.parse(match[0]) } catch {}
    }

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  } catch (err) {
    return new Response(JSON.stringify({ eiq: null, fuente: 'Error: ' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}

export const config = {
  path: '/api/buscar-eiq'
}
