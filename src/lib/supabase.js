import { createClient } from '@supabase/supabase-js'

// ⚠️  Reemplazá estos valores con los de tu proyecto Supabase
// Settings → API → Project URL + anon public key
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || 'https://bfzngmxlucgdqhjzatqr.supabase.co'
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmem5nbXhsdWNnZHFoanphdHFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTA4MDksImV4cCI6MjA4OTU4NjgwOX0.g9XZxhoBQFDxreOCnGyxTgxCZKgi8hcn6yH1ZWDaCYA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// ─── Dólar oficial (dolarapi.com) ────────────────────────────
export async function getDolarOficial() {
  try {
    // Primero revisamos si tenemos cotización de hoy en caché
    const today = new Date().toISOString().split('T')[0]
    const { data: cached } = await supabase
      .from('cotizaciones_usd')
      .select('venta')
      .eq('fecha', today)
      .eq('tipo', 'oficial')
      .single()

    if (cached) return cached.venta

    // Si no, consultamos la API externa
    const res = await fetch('https://dolarapi.com/v1/dolares/oficial')
    const json = await res.json()
    const venta = json.venta

    // Guardamos en caché
    await supabase.from('cotizaciones_usd').upsert({
      fecha: today, tipo: 'oficial',
      compra: json.compra, venta,
      fuente: 'dolarapi.com'
    }, { onConflict: 'fecha,tipo' })

    return venta
  } catch {
    return null
  }
}

// ─── Helpers por tabla ───────────────────────────────────────

export const db = {
  // Viajes
  viajes: {
    list: (filters = {}) => {
      let q = supabase.from('viajes').select('*').order('fecha', { ascending: false })
      if (filters.quien) q = q.eq('quien', filters.quien)
      if (filters.campanha) q = q.eq('campanha', filters.campanha)
      return q
    },
    insert: (data) => supabase.from('viajes').insert(data),
    update: (id, data) => supabase.from('viajes').update(data).eq('id', id),
    delete: (id) => supabase.from('viajes').delete().eq('id', id),
  },

  // Costos
  costos: {
    list: (filters = {}) => {
      let q = supabase.from('costos').select('*').order('fecha', { ascending: false })
      if (filters.campanha)     q = q.eq('campanha', filters.campanha)
      if (filters.centro)       q = q.eq('centro_costos', filters.centro)
      if (filters.quien_carga)  q = q.eq('quien_carga', filters.quien_carga)
      return q
    },
    insert: (data) => supabase.from('costos').insert(data),
    update: (id, data) => supabase.from('costos').update(data).eq('id', id),
    delete: (id) => supabase.from('costos').delete().eq('id', id),
    byCentro: (campanha) =>
      supabase.from('v_costos_por_centro').select('*').eq('campanha', campanha),
  },

  // Precipitaciones
  precipitaciones: {
    list: () => supabase.from('precipitaciones').select('*').order('fecha', { ascending: false }),
    insert: (data) => supabase.from('precipitaciones').insert(data),
    mensual: () => supabase.from('v_lluvias_mensual').select('*').limit(12),
  },

  // Granos
  granos: {
    list: (campanha) => {
      let q = supabase.from('granos_viajes').select('*, granos_liquidaciones(*)').order('fecha', { ascending: false })
      if (campanha) q = q.eq('campanha', campanha)
      return q
    },
    insert: (data) => supabase.from('granos_viajes').insert(data),
  },

  // Stock insumos
  stock: {
    movimientos: () => supabase.from('stock_insumos').select('*').order('fecha', { ascending: false }),
    actual: () => supabase.from('v_stock_actual').select('*'),
    insert: (data) => supabase.from('stock_insumos').insert(data),
  },

  // Aplicaciones
  aplicaciones: {
    list: () => supabase.from('aplicaciones').select('*').order('fecha', { ascending: false }),
    insert: (data) => supabase.from('aplicaciones').insert(data),
  },

  // Cotizaciones
  cotizacion: {
    hoy: () => getDolarOficial(),
  },

  // Upload foto factura
  uploadFoto: async (file, costoId) => {
    const ext  = file.name.split('.').pop()
    const path = `facturas/${costoId}.${ext}`
    const { error } = await supabase.storage.from('facturas').upload(path, file, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('facturas').getPublicUrl(path)
    return data.publicUrl
  },
}

// ─── Exportar a CSV ──────────────────────────────────────────
export function exportCSV(rows, filename) {
  if (!rows?.length) return
  const headers = Object.keys(rows[0]).join(',')
  const body = rows.map(r =>
    Object.values(r).map(v =>
      typeof v === 'string' && v.includes(',') ? `"${v}"` : v
    ).join(',')
  ).join('\n')
  const blob = new Blob([`${headers}\n${body}`], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  a.click(); URL.revokeObjectURL(url)
}
