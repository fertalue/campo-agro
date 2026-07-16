import { supabase } from './supabase'

// ─── Helpers para listas de datos maestros ──────────────────────────────────
// Patrón: los módulos declaran su lista hardcodeada como fallback y llaman
// cargarMaestro(tipo, LISTA) a nivel de módulo. La carga muta el array in-place,
// así todos los componentes que lo referencian ven la lista actualizada al
// siguiente render. Si no hay red (PWA offline) queda el fallback local.

export function cargarMaestro(tipo, destino) {
  supabase.from('maestros').select('valor')
    .eq('tipo', tipo).eq('activo', true).order('orden').order('valor')
    .then(({ data }) => {
      if (data?.length) destino.splice(0, destino.length, ...data.map(d => d.valor))
    })
    .catch(() => {})
}

// Alta automática: inserta el valor en maestros si no existe (case-insensitive).
// Usar al guardar formularios donde el usuario puede tipear un valor nuevo
// (compradores, titulares, etc.), así la lista se autoalimenta y el valor
// aparece en Datos Maestros. Silencioso ante errores (ej. offline).
export async function asegurarMaestro(tipo, valor, destino = null) {
  const v = (valor || '').trim()
  if (!v) return
  try {
    const { data } = await supabase.from('maestros')
      .select('id').eq('tipo', tipo).ilike('valor', v).limit(1)
    if (data?.length) return
    await supabase.from('maestros').insert({ tipo, valor: v, orden: 999, activo: true })
    if (destino && !destino.some(x => x.toLowerCase() === v.toLowerCase())) destino.push(v)
  } catch { /* offline o RLS: se ignora, el registro principal no se afecta */ }
}
