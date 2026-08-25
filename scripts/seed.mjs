import pg from 'pg'
import bcrypt from 'bcryptjs'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no configurado')
  process.exit(1)
}

async function seed() {
  const client = new pg.Client({ connectionString: DATABASE_URL })

  try {
    await client.connect()

    // ─── Cliente: Compo Expert (primer cliente real) ───
    const compoResult = await client.query(`
      INSERT INTO clients (name, slug, waba_id, phone_number_id, system_user_token, meta_app_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [
      'Compo Expert',
      'compo-expert',
      null,  // Rellenar con WABA ID real
      null,  // Rellenar con Phone Number ID real
      null,  // Rellenar con System User Token real
      null,  // Rellenar con Meta App ID
    ])

    const compoId = compoResult.rows[0].id
    console.log(`✅ Cliente "Compo Expert" creado (id: ${compoId})`)

    // ─── Cliente: MCI Admin (para tu propio acceso superadmin) ───
    const mciResult = await client.query(`
      INSERT INTO clients (name, slug, waba_id, phone_number_id, system_user_token, meta_app_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [
      'Agrícola MCI',
      'mci-admin',
      null,
      null,
      null,
      '1757661922158357',
    ])

    const mciId = mciResult.rows[0].id
    console.log(`✅ Cliente "Agrícola MCI" creado (id: ${mciId})`)

    // ─── Superadmin: Vicente ───
    const adminPassword = await bcrypt.hash('cambiar123', 12)
    await client.query(`
      INSERT INTO users (client_id, email, password_hash, name, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `, [mciId, 'contacto@agricolamci.cl', adminPassword, 'Vicente', 'superadmin'])

    console.log('✅ Superadmin creado (email: contacto@agricolamci.cl, password: cambiar123)')
    console.log('')
    console.log('⚠️  CAMBIA LA CONTRASEÑA después del primer login.')
    console.log('⚠️  Rellena waba_id, phone_number_id y system_user_token de cada cliente.')

  } catch (err) {
    console.error('❌ Error en seed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

seed()
