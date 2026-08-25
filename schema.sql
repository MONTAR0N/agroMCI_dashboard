-- ============================================================
-- MCI Dashboard — Schema completo
-- Ejecutar contra la base de datos mci_dashboard
-- ============================================================

-- Crear la base de datos (ejecutar aparte si es necesario):
-- CREATE DATABASE mci_dashboard;

-- ============================================================
-- FASE 1: Clientes y autenticación
-- ============================================================

CREATE TABLE IF NOT EXISTS clients (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,                -- Nombre comercial: "Compo Expert"
  slug          VARCHAR(100) UNIQUE NOT NULL,          -- URL-safe: "compo-expert"
  waba_id       VARCHAR(100),                          -- WhatsApp Business Account ID
  phone_number_id VARCHAR(100),                        -- Phone Number ID registrado
  system_user_token TEXT,                              -- Token del system user (encriptado en producción)
  meta_app_id   VARCHAR(100),                          -- App ID en Meta
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  client_id     INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255),
  role          VARCHAR(50) DEFAULT 'user',            -- 'superadmin' (Vicente), 'admin' (cliente), 'user'
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

-- ============================================================
-- FASE 3: Contactos
-- ============================================================

CREATE TABLE IF NOT EXISTS contacts (
  id            SERIAL PRIMARY KEY,
  client_id     INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  phone         VARCHAR(50) NOT NULL,                  -- Formato E.164: +56912345678
  name          VARCHAR(255),
  extra         JSONB DEFAULT '{}',                    -- Columnas adicionales del CSV
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, phone)
);

CREATE INDEX idx_contacts_client ON contacts(client_id);
CREATE INDEX idx_contacts_phone ON contacts(client_id, phone);

-- ============================================================
-- FASE 4: Campañas y tracking de mensajes
-- ============================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id              SERIAL PRIMARY KEY,
  client_id       INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  template_name   VARCHAR(255) NOT NULL,               -- Nombre del template en Meta
  template_lang   VARCHAR(10) DEFAULT 'es',
  template_data   JSONB DEFAULT '{}',                  -- Configuración de componentes/variables
  status          VARCHAR(50) DEFAULT 'draft',         -- draft, sending, paused, completed, failed
  total_contacts  INTEGER DEFAULT 0,
  sent_count      INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count      INTEGER DEFAULT 0,
  failed_count    INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_campaigns_client ON campaigns(client_id);
CREATE INDEX idx_campaigns_status ON campaigns(client_id, status);

CREATE TABLE IF NOT EXISTS campaign_messages (
  id            SERIAL PRIMARY KEY,
  campaign_id   INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id    INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  phone         VARCHAR(50) NOT NULL,                  -- Guardamos el teléfono directo por si el contacto se borra
  wamid         VARCHAR(255),                          -- WhatsApp Message ID (lo devuelve Meta al enviar)
  status        VARCHAR(50) DEFAULT 'pending',         -- pending, sent, delivered, read, failed
  error_code    VARCHAR(50),
  error_message TEXT,
  sent_at       TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  read_at       TIMESTAMPTZ
);

CREATE INDEX idx_cm_campaign ON campaign_messages(campaign_id);
CREATE INDEX idx_cm_status ON campaign_messages(campaign_id, status);
CREATE INDEX idx_cm_wamid ON campaign_messages(wamid);

-- ============================================================
-- Función para actualizar updated_at automáticamente
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
