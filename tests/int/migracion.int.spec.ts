// @vitest-environment node
import { sql } from '@payloadcms/db-postgres'
import { drizzle } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import * as inicial from '@/migrations/20261121_234353_inicial'
import * as usuariosYRoles from '@/migrations/20261122_000140_usuarios_y_roles'

/**
 * Prueba la migración sobre una base con el esquema y los datos anteriores al cambio.
 * Usa una base descartable, al lado de la de tests.
 */
describe('migración usuarios_y_roles', () => {
  const urlTests = process.env.DATABASE_URL!
  const url = new URL(urlTests)
  const nombreBase = `${url.pathname.slice(1)}_migracion`
  url.pathname = `/${nombreBase}`

  const servidor = drizzle(urlTests)
  let db: ReturnType<typeof drizzle>

  const migrar = (migracion: { up: typeof inicial.up }) => migracion.up({ db } as never)
  const filas = async (consulta: ReturnType<typeof sql>) => (await db.execute(consulta)).rows

  beforeAll(async () => {
    await servidor.execute(sql.raw(`DROP DATABASE IF EXISTS "${nombreBase}" WITH (FORCE)`))
    await servidor.execute(sql.raw(`CREATE DATABASE "${nombreBase}"`))
    db = drizzle(url.toString())

    await migrar(inicial)
    await db.execute(sql`INSERT INTO users (email) VALUES ('ana.previa@test.local')`)
    await db.execute(sql`INSERT INTO media (alt) VALUES ('Foto previa')`)
    await migrar(usuariosYRoles)
  })

  afterAll(async () => {
    await (db?.$client as { end: () => Promise<void> } | undefined)?.end()
    await servidor.execute(sql.raw(`DROP DATABASE IF EXISTS "${nombreBase}" WITH (FORCE)`))
    await (servidor.$client as { end: () => Promise<void> }).end()
  })

  it('los usuarios existentes quedan como admin, con un nombre derivado del email', async () => {
    expect(await filas(sql`SELECT nombre, role FROM users`)).toEqual([
      { nombre: 'ana.previa', role: 'admin' },
    ])
  })

  it('los archivos existentes quedan sin autor', async () => {
    expect(await filas(sql`SELECT alt, autor_id FROM media`)).toEqual([
      { alt: 'Foto previa', autor_id: null },
    ])
  })

  it('el nombre queda obligatorio', async () => {
    await expect(
      db.execute(sql`INSERT INTO users (email) VALUES ('sin.nombre@test.local')`),
    ).rejects.toBeTruthy()
  })

  it('down y up de nuevo conservan a los usuarios', async () => {
    await usuariosYRoles.down({ db } as never)
    await migrar(usuariosYRoles)
    expect(await filas(sql`SELECT email, role FROM users`)).toEqual([
      { email: 'ana.previa@test.local', role: 'admin' },
    ])
  })
})
