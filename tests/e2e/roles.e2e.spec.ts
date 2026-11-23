import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import type { Media, User } from '../../src/payload-types'
import { login } from '../helpers/login'

const BASE = 'http://localhost:3000'
const CLAVE = 'clave-e2e-segura'

// PNG de 1x1 píxel.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

/**
 * Este archivo crea sus propios usuarios (con emails únicos) y los borra al final, sin
 * vaciar la base. Los archivos e2e corren de a uno (`workers: 1`), pero comparten base:
 * así ninguno depende de lo que haya dejado otro.
 */
test.describe('Roles', () => {
  let payload: Payload
  let admin: User
  let ana: User
  let beto: User
  let deBeto: Media
  const sufijo = `${Date.now()}`

  const crear = (nombre: string, role: User['role']) =>
    payload.create({
      collection: 'users',
      data: { nombre, email: `${nombre.toLowerCase()}-${sufijo}@e2e.local`, password: CLAVE, role },
    })

  const tokenDe = async (request: import('@playwright/test').APIRequestContext, user: User) => {
    const res = await request.post(`${BASE}/api/users/login`, {
      data: { email: user.email, password: CLAVE },
    })
    expect(res.ok()).toBe(true)
    return ((await res.json()) as { token: string }).token
  }

  test.beforeAll(async () => {
    payload = await getPayload({ config })
    // Admin primero: si la tabla estuviera vacía, el primer usuario sería admin igual.
    admin = await crear('AdminE2E', 'admin')
    ana = await crear('AnaE2E', 'usuario')
    beto = await crear('BetoE2E', 'usuario')
    deBeto = await payload.create({
      collection: 'media',
      data: { alt: 'Foto de Beto', autor: beto.id },
      file: { data: PNG_1X1, mimetype: 'image/png', name: `beto-${sufijo}.png`, size: PNG_1X1.length },
    })
  })

  test.afterAll(async () => {
    const ids = [admin, ana, beto].map((u) => u.id)
    await payload.db.deleteMany({ collection: 'media', where: { autor: { in: ids } } })
    // Directo en la base: la protección del último admin bloquearía el borrado.
    await payload.db.deleteMany({ collection: 'users', where: { id: { in: ids } } })
  })

  test.describe('panel', () => {
    test('un usuario inicia sesión pero el panel le niega el acceso', async ({ page }) => {
      await page.goto(`${BASE}/admin/login`)
      await page.fill('#field-email', ana.email)
      await page.fill('#field-password', CLAVE)
      await page.click('button[type="submit"]')

      await expect(page.getByText('You are not allowed to access this page.')).toBeVisible()
      await expect(page.locator('span[title="Dashboard"]')).toHaveCount(0)
    })

    test('un admin ve el campo Rol al editar un usuario y el campo Autor al editar un archivo', async ({
      page,
    }) => {
      await login({ page, user: { email: admin.email, password: CLAVE } })

      await page.goto(`${BASE}/admin/collections/users/${ana.id}`)
      await expect(page.locator('#field-role')).toBeVisible()

      await page.goto(`${BASE}/admin/collections/media/${deBeto.id}`)
      await expect(page.locator('#field-autor')).toBeVisible()
    })
  })

  test.describe('API REST', () => {
    test('un usuario sube un archivo y queda como autor', async ({ request }) => {
      const token = await tokenDe(request, ana)
      const res = await request.post(`${BASE}/api/media`, {
        headers: { Authorization: `JWT ${token}` },
        multipart: {
          file: { name: `ana-${sufijo}.png`, mimeType: 'image/png', buffer: PNG_1X1 },
          _payload: JSON.stringify({ alt: 'Foto de Ana', autor: beto.id }),
        },
      })
      expect(res.status()).toBe(201)
      const { doc } = (await res.json()) as { doc: Media }
      const autorId = typeof doc.autor === 'object' ? doc.autor?.id : doc.autor
      expect(autorId).toBe(ana.id)
      await payload.db.deleteMany({ collection: 'media', where: { id: { equals: doc.id } } })
    })

    test('un usuario no puede borrar un archivo ajeno', async ({ request }) => {
      const token = await tokenDe(request, ana)
      const res = await request.delete(`${BASE}/api/media/${deBeto.id}`, {
        headers: { Authorization: `JWT ${token}` },
      })
      expect([403, 404]).toContain(res.status())

      const sigue = await payload.findByID({ collection: 'media', id: deBeto.id })
      expect(sigue.id).toBe(deBeto.id)
    })

    test('sin sesión no se pueden listar archivos', async ({ request }) => {
      const res = await request.get(`${BASE}/api/media`)
      expect(res.status()).toBe(403)
    })
  })
})
