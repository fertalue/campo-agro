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
        temperature: 0,
        messages: [{
          role: 'user',
          content: `What is the EIQ (Environmental Impact Quotient) field value for the pesticide active ingredient "${producto}"${marca ? ' (brand: ' + marca + ')' : ''}? Use the Cornell University EIQ database values (Kovach et al.). Common examples: glyphosate=15.3, 2,4-D=18.4, atrazine=22.0, chlorpyrifos=134.3, lambda-cyhalothrin=37.5, imidacloprid=74.7. If you know the specific value from Cornell's database, return it. If uncertain, return null. Respond ONLY with valid JSON, no extra text: {"eiq": number_or_null, "fuente": "Cornell EIQ database"}`
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
