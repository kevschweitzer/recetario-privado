import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

export const testUser = {
  email: 'dev@payloadcms.com',
  password: 'test',
}

/** Datos con los que se crea el usuario de prueba (admin, para poder usar el panel). */
const testUserData = {
  ...testUser,
  nombre: 'Dev',
  role: 'admin' as const,
}

/**
 * Seeds a test user for e2e admin tests.
 */
export async function seedTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  // Delete existing test user if any. Directo en la base (sin hooks): la protección
  // del último admin bloquearía el borrado si este fuera el único admin.
  await payload.db.deleteMany({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })

  // Create fresh test user
  await payload.create({
    collection: 'users',
    data: testUserData,
  })
}

/**
 * Cleans up test user after tests
 */
export async function cleanupTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  await payload.db.deleteMany({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })
}
