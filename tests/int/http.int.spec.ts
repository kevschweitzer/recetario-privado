// @vitest-environment node
// (jose, usado por el login de Payload, falla bajo jsdom)
import { GRAPHQL_POST } from '@payloadcms/next/routes'
import fs from 'fs'
import path from 'path'
import { getPayload, handleEndpoints, type Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Media, User } from '@/payload-types'

import { crearUsuario, resetDb } from '../helpers/db'
import { mediaDeTests } from '../helpers/loadTestEnv'

const BASE = 'http://localhost:3000'
const CLAVE = 'clave-de-prueba'

// PNG de 1x1 píxel.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

/** Las mismas reglas, pero entrando por los handlers HTTP y no por la Local API. */
describe('HTTP', () => {
  let payload: Payload
  let admin: User
  let ana: User
  let beto: User
  let deBeto: Media

  const headers = async (user?: User) => {
    const resultado = new Headers({ 'Content-Type': 'application/json' })
    if (user) {
      const { token } = await payload.login({
        collection: 'users',
        data: { email: user.email, password: CLAVE },
      })
      resultado.set('Authorization', `JWT ${token}`)
    }
    return resultado
  }

  const rest = async (method: string, ruta: string, user?: User, body?: unknown) =>
    handleEndpoints({
      config,
      request: new Request(`${BASE}${ruta}`, {
        method,
        headers: await headers(user),
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    })

  const graphql = async (query: string, user?: User) => {
    const respuesta = await GRAPHQL_POST(config)(
      new Request(`${BASE}/api/graphql`, {
        method: 'POST',
        headers: await headers(user),
        body: JSON.stringify({ query }),
      }),
    )
    return (await respuesta.json()) as {
      data: Record<string, unknown>
      errors?: { extensions: { statusCode: number } }[]
    }
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  beforeEach(async () => {
    await resetDb(payload)
    admin = await crearUsuario(payload, { nombre: 'Admin', role: 'admin' })
    ana = await crearUsuario(payload, { nombre: 'Ana' })
    beto = await crearUsuario(payload, { nombre: 'Beto' })
    deBeto = await payload.create({
      collection: 'media',
      data: { alt: 'Foto de Beto', autor: beto.id },
      file: {
        data: PNG_1X1,
        mimetype: 'image/png',
        name: `http-${Date.now()}.png`,
        size: PNG_1X1.length,
      },
    })
  })

  describe('GraphQL', () => {
    it('un usuario no puede modificar ni borrar un archivo ajeno', async () => {
      for (const mutacion of [
        `mutation { updateMedia(id: ${deBeto.id}, data: { alt: "Cambiado" }) { id } }`,
        `mutation { deleteMedia(id: ${deBeto.id}) { id } }`,
      ]) {
        const { errors } = await graphql(mutacion, ana)
        expect(errors?.[0].extensions.statusCode).toBe(403)
      }
      const doc = await payload.findByID({ collection: 'media', id: deBeto.id })
      expect(doc.alt).toBe('Foto de Beto')
    })

    it('el autor sí modifica su archivo', async () => {
      const { data } = await graphql(
        `mutation { updateMedia(id: ${deBeto.id}, data: { alt: "Nuevo" }) { alt } }`,
        beto,
      )
      expect(data.updateMedia).toEqual({ alt: 'Nuevo' })
    })

    it('un usuario ve nombres ajenos, pero no emails ni roles', async () => {
      const { data } = await graphql('{ Users { docs { id nombre email role } } }', ana)
      const { docs } = data.Users as { docs: Pick<User, 'id' | 'nombre' | 'email' | 'role'>[] }
      expect(docs.find((d) => d.id === beto.id)).toEqual({
        id: beto.id,
        nombre: 'Beto',
        email: null,
        role: null,
      })
    })

    it('sin sesión no se pueden listar archivos', async () => {
      const { errors } = await graphql('{ allMedia { docs { id } } }')
      expect(errors?.[0].extensions.statusCode).toBe(403)
    })
  })

  describe('archivos', () => {
    it('descargar un archivo requiere sesión', async () => {
      const ruta = `/api/media/file/${deBeto.filename}`
      expect((await rest('GET', ruta)).status).toBe(403)

      const conSesion = await rest('GET', ruta, ana)
      expect(conSesion.status).toBe(200)
      expect((await conSesion.arrayBuffer()).byteLength).toBeGreaterThan(0)
    })

    it('los tests guardan los archivos en su propia carpeta', () => {
      expect(fs.existsSync(path.join(mediaDeTests(), deBeto.filename!))).toBe(true)
      expect(fs.existsSync(path.resolve('media', deBeto.filename!))).toBe(false)
    })
  })

  describe('emails ocultos', () => {
    it.each([
      ['filtrar usuarios por email', '/api/users?where[email][equals]=x@test.local'],
      ['ordenar usuarios por email', '/api/users?sort=email'],
      ['filtrar archivos por email del autor', '/api/media?where[autor.email][equals]=x@test.local'],
    ])('un usuario no puede %s', async (_caso, ruta) => {
      expect((await rest('GET', ruta, ana)).status).toBe(400)
    })
  })

  describe('último admin', () => {
    it.each([
      ['DELETE', undefined],
      ['PATCH', { role: 'usuario' }],
    ])('%s masivo sobre todos los admins se rechaza entero', async (method, body) => {
      await crearUsuario(payload, { role: 'admin' })
      const respuesta = await rest(method, '/api/users?where[role][equals]=admin', admin, body)
      expect(respuesta.status).toBe(400)
      expect(await respuesta.text()).toContain('al menos un usuario con rol admin')

      const { totalDocs } = await payload.count({
        collection: 'users',
        where: { role: { equals: 'admin' } },
      })
      expect(totalDocs).toBe(2)
    })
  })

  describe('desbloqueo', () => {
    it('un usuario no puede desbloquear otra cuenta', async () => {
      const respuesta = await rest('POST', '/api/users/unlock', ana, { email: beto.email })
      expect(respuesta.status).toBe(403)
    })
  })

  describe('alta inicial', () => {
    it('la primera cuenta queda como admin y después el alta inicial se cierra', async () => {
      await resetDb(payload)
      const alta = (nombre: string) =>
        rest('POST', '/api/users/first-register', undefined, {
          nombre,
          email: `${nombre.toLowerCase()}@test.local`,
          password: CLAVE,
          role: 'usuario',
        })

      expect((await alta('Primera')).status).toBe(200)
      expect((await alta('Segunda')).status).toBe(403)

      const { docs } = await payload.find({ collection: 'users' })
      expect(docs.map((d) => [d.nombre, d.role])).toEqual([['Primera', 'admin']])
    })
  })
})
