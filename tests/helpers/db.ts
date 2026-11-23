import type { Payload } from 'payload'

import type { User } from '@/payload-types'

/**
 * Vacía usuarios y medios de la base de tests. Usa el adaptador directamente
 * (sin hooks) porque la protección del último admin impediría borrar a todos.
 */
export async function resetDb(payload: Payload): Promise<void> {
  await payload.db.deleteMany({ collection: 'media', where: {} })
  await payload.db.deleteMany({ collection: 'users', where: {} })
}

let contador = 0

/** Crea un usuario saltando el control de acceso (como haría un admin desde el panel). */
export async function crearUsuario(
  payload: Payload,
  data: Partial<Pick<User, 'nombre' | 'email' | 'role'>> & { password?: string } = {},
): Promise<User> {
  contador += 1
  return payload.create({
    collection: 'users',
    data: {
      nombre: data.nombre ?? `Persona ${contador}`,
      email: data.email ?? `persona${contador}-${Date.now()}@test.local`,
      password: data.password ?? 'clave-de-prueba',
      role: data.role ?? 'usuario',
    },
  })
}
