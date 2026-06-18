import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import lotesData from '../data/lotes.json'

// ── Proyección ──────────────────────────────────────────────────────────────
function calcBbox(features) {
  let minLng=Infinity, maxLng=-Infinity, minLat=Infinity, maxLat=-Infinity
  features.forEach(f => {
    f.geometry.coordinates[0].forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat
    })
  })
  return { minLng, maxLng, minLat, maxLat }
}

function project(lng, lat, bbox, W, H, pad=20) {
  const rng_lng = bbox.maxLng - bbox.minLng || 0.001
  const rng_lat = bbox.maxLat - bbox.minLat || 0.001
  // Corregir aspecto: 1° lng < 1° lat en Córdoba (factor ~0.857 @ -31°)
  const cos = Math.cos((bbox.minLat + bbox.maxLat) / 2 * Math.PI / 180)
  const aspectData = (rng_lng * cos) / rng_lat
  const usableW = W - 2*pad, usableH = H - 2*pad
  let scaleX, scaleY, offX=pad, offY=pad
  if (aspectData > usableW/usableH) {
    scaleX = usableW / (rng_lng * cos)
    scaleY = scaleX
    offY = pad + (usableH - rng_lat * scaleY) / 2
  } else {
    scaleY = usableH / rng_lat
    scaleX = scaleY
    offX = pad + (usableW - rng_lng * cos * scaleX) / 2
  }
  const x = offX + (lng - bbox.minLng) * cos * scaleX
  const y = offY + (bbox.maxLat - lat) * scaleY
  return [x, y]
}

function featureToPath(feature, bbox, W, H) {
  return feature.geometry.coordinates[0]
    .map(([lng, lat]) => project(lng, lat, bbox, W, H))
    .map(([x, y], i) => `${i===0?'M':'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ') + ' Z'
}

function centroide(feature, bbox, W, H) {
  const pts = feature.geometry.coordinates[0]
  const avg = pts.reduce(([ax,ay],[lng,lat]) => [ax+lng,ay+lat], [0,0])
    .map(v => v / pts.length)
  return project(avg[0], avg[1], bbox, W, H)
}

// Área de polígono SVG (Shoelace) → convierte a ha aproximado
function svgAreaHa(pts, bbox, W, H, pad=20) {
  if (pts.length < 3) return 0
  const rng_lng = bbox.maxLng - bbox.minLng || 0.001
  const rng_lat = bbox.maxLat - bbox.minLat || 0.001
  const cos = Math.cos((bbox.minLat + bbox.maxLat) / 2 * Math.PI / 180)
  const usableW = W - 2*pad, usableH = H - 2*pad
  const aspectData = (rng_lng * cos) / rng_lat
  let scaleX, scaleY
  if (aspectData > usableW/usableH) {
    scaleX = usableW / (rng_lng * cos); scaleY = scaleX
  } else {
    scaleY = usableH / rng_lat; scaleX = scaleY
  }
  // Shoelace en píxeles → convertir a grados → km² → ha
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1,y1] = pts[i]; const [x2,y2] = pts[(i+1)%pts.length]
    area += x1*y2 - x2*y1
  }
  area = Math.abs(area)/2
  // px² → grados²: 1px = 1/(scaleY) lat-degrees, 1px = 1/(scaleX*cos) lng-degrees
  const areaDeg2 = area / (scaleX * cos * scaleY)
  // grados² → km²: 1° lat = 111.32 km
  const areaKm2 = areaDeg2 * 111.32 * 111.32
  return areaKm2 * 100
}

// ── Componente principal ─────────────────────────────────────────────────────
const MapaLote = forwardRef(function MapaLote({
  lotesResaltados = [],   // IDs a resaltar (ej: [1,2])
  editable = false,       // Activar herramienta de dibujo
  zonaInicial = null,     // [[x,y], ...] puntos SVG de zona pre-dibujada
  onZonaChange = null,    // Callback cuando cambia la zona dibujada
  width = 500,
  height = 340,
}, ref) {
  const svgRef = useRef()
  const [vertices, setVertices] = useState([])   // vértices en curso
  const [zona, setZona]         = useState(zonaInicial) // polígono terminado
  const [modo, setModo]         = useState('ver')        // 'ver' | 'dibujar'
  const [dragging, setDragging] = useState(null)  // índice de vértice arrastrado

  const features = lotesData.features
  // BBox: si hay resaltados, zoom a ellos con padding; sino, todos
  const target = lotesResaltados.length
    ? features.filter(f => lotesResaltados.includes(f.properties.id))
    : features
  const bbox = calcBbox(target.length ? target : features)
  // Agregar 8% de padding al bbox
  const padLng = (bbox.maxLng - bbox.minLng) * 0.12
  const padLat = (bbox.maxLat - bbox.minLat) * 0.12
  const bboxPad = {
    minLng: bbox.minLng - padLng, maxLng: bbox.maxLng + padLng,
    minLat: bbox.minLat - padLat, maxLat: bbox.maxLat + padLat,
  }

  const proj  = (lng, lat) => project(lng, lat, bboxPad, width, height, 0)
  const path  = (f) => featureToPath(f, bboxPad, width, height)
  const ctr   = (f) => centroide(f, bboxPad, width, height)

  // Escala gráfica: ~500m en pantalla
  const kmPerLng = 111.32 * Math.cos((bboxPad.minLat+bboxPad.maxLat)/2*Math.PI/180)
  const kmTot    = (bboxPad.maxLng - bboxPad.minLng) * kmPerLng
  const scaleKm  = kmTot > 4 ? 2 : 0.5
  const scaleW   = (scaleKm / kmTot) * width

  // --- Dibujo ---
  function handleSvgClick(e) {
    if (modo !== 'dibujar') return
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setVertices(v => [...v, [x, y]])
  }
  function handleSvgDblClick(e) {
    if (modo !== 'dibujar' || vertices.length < 3) return
    e.preventDefault()
    const nueva = [...vertices]
    setZona(nueva)
    setVertices([])
    setModo('ver')
    onZonaChange?.(nueva)
  }
  function borrarZona() { setZona(null); setVertices([]); onZonaChange?.(null) }
  function iniciarDibujo() { setModo('dibujar'); setZona(null); setVertices([]) }

  // Arrastrar vértice
  function startDrag(e, i) {
    e.stopPropagation(); setDragging(i)
  }
  function onMouseMove(e) {
    if (dragging === null) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    setZona(z => z.map((v, i) => i === dragging ? [x, y] : v))
    onZonaChange?.(zona)
  }
  function stopDrag() { setDragging(null) }

  const zonaArea = zona ? svgAreaHa(zona, bboxPad, width, height, 0) : null

  // --- Exportar PNG ---
  useImperativeHandle(ref, () => ({
    async capturar() {
      const svg = svgRef.current
      if (!svg) return null
      const svgStr = new XMLSerializer().serializeToString(svg)
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = width * 2; canvas.height = height * 2
          const ctx = canvas.getContext('2d')
          ctx.scale(2, 2)
          ctx.fillStyle = '#f8f5f0'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)
          URL.revokeObjectURL(url)
          resolve(canvas.toDataURL('image/png'))
        }
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
        img.src = url
      })
    },
    getZona: () => zona,
    getZonaHa: () => zonaArea,
  }))

  const COLORS = { highlight: '#4A7C3F', otros: '#B8C9A3', borde: '#6B3E22' }

  return (
    <div style={{ userSelect:'none' }}>
      {/* Controles de edición */}
      {editable && (
        <div style={{ display:'flex', gap:6, marginBottom:6, flexWrap:'wrap' }}>
          {modo === 'ver' ? (
            <button onClick={iniciarDibujo}
              style={{ padding:'4px 10px', border:'1px solid #7A9EAD', borderRadius:5, fontSize:11,
                background:'#E4F0F4', color:'#2C5A6A', cursor:'pointer', fontFamily:'inherit' }}>
              ✏ Dibujar zona parcial
            </button>
          ) : (
            <span style={{ fontSize:11, color:'#2C5A6A', padding:'4px 8px', background:'#E4F0F4', borderRadius:5 }}>
              Hacé click para agregar vértices · Doble click para cerrar
            </span>
          )}
          {zona && (
            <>
              <span style={{ fontSize:11, color:'#2E4F26', padding:'4px 8px', background:'#EBF4E8', borderRadius:5 }}>
                ~{zonaArea?.toFixed(1)} ha marcadas
              </span>
              <button onClick={borrarZona}
                style={{ padding:'4px 8px', border:'1px solid #F0997B', borderRadius:5, fontSize:11,
                  background:'#FAECE7', color:'#993C1D', cursor:'pointer', fontFamily:'inherit' }}>
                ✕ Borrar zona
              </button>
            </>
          )}
        </div>
      )}

      {/* SVG del mapa */}
      <svg
        ref={svgRef}
        width={width} height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ border:'1px solid #D8C9A8', borderRadius:8, background:'#f0ece4',
          cursor: modo==='dibujar' ? 'crosshair' : dragging!==null ? 'grabbing' : 'default' }}
        onClick={handleSvgClick}
        onDoubleClick={handleSvgDblClick}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
      >
        {/* Fondo */}
        <rect width={width} height={height} fill="#f0ece4"/>

        {/* Todos los lotes (gris claro de fondo) */}
        {features.map(f => (
          <path key={`bg-${f.properties.id}`}
            d={featureToPath(f, bboxPad, width, height)}
            fill="#d4dfc8" stroke="#8fac7a" strokeWidth={0.5}/>
        ))}

        {/* Lotes resaltados */}
        {features
          .filter(f => lotesResaltados.includes(f.properties.id))
          .map(f => (
            <path key={`hl-${f.properties.id}`}
              d={featureToPath(f, bboxPad, width, height)}
              fill={COLORS.highlight} fillOpacity={0.35}
              stroke={COLORS.highlight} strokeWidth={2}/>
          ))
        }

        {/* Etiquetas de lotes */}
        {features.map(f => {
          const [cx, cy] = centroide(f, bboxPad, width, height)
          const resaltado = lotesResaltados.includes(f.properties.id)
          return (
            <g key={`label-${f.properties.id}`}>
              <text x={cx} y={cy-6} textAnchor="middle"
                fontSize={resaltado?13:10} fontWeight={resaltado?700:400}
                fill={resaltado?'#2E4F26':'#5a7040'}
                style={{pointerEvents:'none'}}>
                {f.properties.nombre}
              </text>
              <text x={cx} y={cy+8} textAnchor="middle"
                fontSize={resaltado?11:9} fill={resaltado?'#2E4F26':'#7a8a6a'}
                style={{pointerEvents:'none'}}>
                {f.properties.area_ha} ha
              </text>
            </g>
          )
        })}

        {/* Zona dibujada (polígono terminado) */}
        {zona && zona.length >= 3 && (
          <>
            <polygon
              points={zona.map(([x,y])=>`${x},${y}`).join(' ')}
              fill="#F5A623" fillOpacity={0.35}
              stroke="#F5A623" strokeWidth={2} strokeDasharray="6,3"/>
            {editable && zona.map(([x,y], i) => (
              <circle key={i} cx={x} cy={y} r={5}
                fill="#F5A623" stroke="white" strokeWidth={1.5}
                style={{ cursor:'grab' }}
                onMouseDown={e=>startDrag(e,i)}/>
            ))}
          </>
        )}

        {/* Vértices en curso */}
        {vertices.length > 0 && (
          <>
            <polyline
              points={vertices.map(([x,y])=>`${x},${y}`).join(' ')}
              fill="none" stroke="#F5A623" strokeWidth={1.5} strokeDasharray="4,2"/>
            {vertices.map(([x,y],i) => (
              <circle key={i} cx={x} cy={y} r={3} fill="#F5A623" stroke="white" strokeWidth={1}/>
            ))}
          </>
        )}

        {/* Rosa de los vientos (Norte) */}
        <g transform={`translate(${width-28},28)`}>
          <circle cx={0} cy={0} r={14} fill="white" fillOpacity={0.8} stroke="#aaa" strokeWidth={0.5}/>
          <polygon points="0,-12 -4,0 0,-3 4,0" fill="#333"/>
          <polygon points="0,12 -4,0 0,3 4,0" fill="#ccc"/>
          <text x={0} y={-14} textAnchor="middle" fontSize={8} fontWeight={700} fill="#333">N</text>
        </g>

        {/* Escala gráfica */}
        <g transform={`translate(10,${height-12})`}>
          <rect x={0} y={-5} width={scaleW} height={5} fill="#555" opacity={0.7}/>
          <rect x={scaleW/2} y={-5} width={scaleW/2} height={5} fill="white" opacity={0.7}/>
          <line x1={0} y1={-5} x2={0} y2={-9} stroke="#555" strokeWidth={0.8}/>
          <line x1={scaleW} y1={-5} x2={scaleW} y2={-9} stroke="#555" strokeWidth={0.8}/>
          <text x={0} y={-11} textAnchor="middle" fontSize={7} fill="#444">0</text>
          <text x={scaleW} y={-11} textAnchor="middle" fontSize={7} fill="#444">{scaleKm} km</text>
        </g>
      </svg>
    </div>
  )
})

export default MapaLote
