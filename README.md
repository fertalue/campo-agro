# Campo — Gestión Agropecuaria

App para Fer, Leo y Gise. PWA (funciona en celu como app nativa) + desktop completo.

## Setup en 5 pasos

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar Supabase
Copiá `.env.example` a `.env.local` y completá con tus credenciales:
```bash
cp .env.example .env.local
# Editá .env.local con tu URL y anon key de Supabase
```

### 3. Correr en desarrollo
```bash
npm run dev
```
Abrí http://localhost:5173

### 4. Deploy en Vercel
```bash
# Instalá Vercel CLI (una sola vez)
npm i -g vercel

# Deploy
vercel

# Configurá las variables de entorno en el dashboard de Vercel:
# VITE_SUPABASE_URL y VITE_SUPABASE_ANON
```

### 5. Instalar como app en el celu
- Abrí la URL de Vercel en Safari (iOS) o Chrome (Android)
- Tocá "Agregar a pantalla de inicio"

---

## Módulos

| Módulo         | Desktop | Móvil       | Roles              |
|----------------|---------|-------------|--------------------|
| Viajes campo   | ✓       | ✓ (Fer/Leo) | Fer, Leo, Admin    |
| Costos         | ✓       | ✓ (Gise)    | Todos              |
| Ventas/Granos  | ✓       | —           | Fer, Leo, Admin    |
| Precipitaciones| ✓       | ✓           | Todos              |
| Almacén        | ✓       | —           | Fer, Leo, Admin    |
| Aplicaciones   | ✓       | —           | Fer, Leo, Admin    |

## Estructura del proyecto

```
src/
  components/
    Sidebar.jsx       — navegación desktop
  hooks/
    useAuth.jsx       — autenticación con Supabase
  lib/
    supabase.js       — cliente + helpers por tabla + exportCSV + dólar API
  pages/
    Login.jsx
    Viajes.jsx        — registro de visitas al campo (Fer/Leo)
    Costos.jsx        — facturas con foto, IVA, conversión USD automática
    Lluvias.jsx       — precipitaciones con historial por mes
    (Ventas, Almacen, Aplicaciones — en construcción)
  styles/
    theme.css         — paleta natural: tierra, pasto, cielo pampeano
  App.jsx             — shell principal + routing + layout responsive
  main.jsx
```
