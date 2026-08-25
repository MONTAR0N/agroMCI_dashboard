# MCI Dashboard

Panel multi-tenant para gestión de campañas WhatsApp — Agrícola MCI.

## Setup rápido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con tus valores reales:

- `DATABASE_URL` — conexión a PostgreSQL (tu VPS o servicio externo)
- `JWT_SECRET` — generar con `openssl rand -hex 32`
- `N8N_BASE_URL` — URL de tu instancia n8n

### 3. Crear la base de datos y aplicar schema

```bash
# En tu VPS, crear la base de datos:
psql -U postgres -c "CREATE DATABASE mci_dashboard;"

# Aplicar el schema:
DATABASE_URL=postgresql://... npm run db:migrate

# Crear el superadmin y primer cliente:
DATABASE_URL=postgresql://... npm run db:seed
```

### 4. Desarrollo local

```bash
npm run dev
```

Abrir `http://localhost:3000/login` con:
- Email: `contacto@agricolamci.cl`
- Password: `cambiar123`

### 5. Deploy a Vercel

```bash
npx vercel login
npx vercel link          # Crear proyecto nuevo
npx vercel env add       # Agregar DATABASE_URL, JWT_SECRET, etc.
npx vercel --prod
```

Después en Vercel → Settings → Domains → agregar `app.agricolamci.cl`.

En HostGator DNS agregar el CNAME que Vercel te indique para `app`.

## Estructura del proyecto

```
app/
  api/auth/         → Login, logout, sesión
  dashboard/        → Layout con sidebar + páginas
  login/            → Pantalla de login
lib/
  auth.ts           → JWT, cookies
  db.ts             → Pool de conexión PostgreSQL
scripts/
  migrate.mjs       → Ejecuta schema.sql
  seed.mjs          → Crea superadmin + primer cliente
schema.sql          → Schema completo (todas las fases)
```

## Fases

- [x] Fase 1 — Auth, base de datos, shell del dashboard
- [ ] Fase 2 — CRUD de plantillas (WhatsApp Management API)
- [ ] Fase 3 — Gestión de contactos (CSV upload)
- [ ] Fase 4 — Campañas (envío masivo vía n8n)
