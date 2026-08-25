import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no configurado')
  process.exit(1)
}

async function migrate() {
  const client = new pg.Client({ connectionString: DATABASE_URL })

  try {
    await client.connect()
    console.log('✅ Conectado a PostgreSQL')

    const schema = readFileSync(resolve(__dirname, '../schema.sql'), 'utf8')
    await client.query(schema)
    console.log('✅ Schema aplicado correctamente')
  } catch (err) {
    console.error('❌ Error en migración:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

migrate()
