// @vitest-environment node
// (jose, usado por el login de Payload, falla bajo jsdom)
import { getPayload, type Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Media, User } from '@/payload-types'

import { crearUsuario, resetDb } from '../helpers/db'

// PNG de 1x1 píxel, suficiente para que Payload lo procese como imagen.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

let payload: Payload
let contadorArchivos = 0

const archivo = () => {
  contadorArchivos += 1
  return {
    data: PNG_1X1,
    mimetype: 'image/png',
    name: `prueba-${Date.now()}-${contadorArchivos}.png`,
    size: PNG_1X1.length,
  }
}

const idDe = (autor: Media['autor']) => (typeof autor === 'object' ? autor?.id : autor)

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

describe('media', () => {
  let admin: User
  let ana: User
  let beto: User
  let deAna: Media
  let deBeto: Media
  let sinAutor: Media

  const subir = (user: User | undefined, data: Partial<Media> = {}) =>
    payload.create({
      collection: 'media',
      data: { alt: 'Foto de prueba', ...data },
      file: archivo(),
      overrideAccess: false,
      user,
    })

  beforeEach(async () => {
    await resetDb(payload)
    admin = await crearUsuario(payload, { nombre: 'Admin', role: 'admin' })
    ana = await crearUsuario(payload, { nombre: 'Ana' })
    beto = await crearUsuario(payload, { nombre: 'Beto' })
    deAna = await subir(ana)
    deBeto = await subir(beto)
    // Como un archivo anterior a este cambio: creado sin usuario, queda sin autor.
    sinAutor = await payload.create({
      collection: 'media',
      data: { alt: 'Archivo viejo' },
      file: archivo(),
    })
  })

  describe('autor', () => {
    it('el archivo de un usuario queda con él como autor', () => {
      expect(idDe(deAna.autor)).toBe(ana.id)
      expect(sinAutor.autor ?? null).toBeNull()
    })

    it('un usuario que indica otro autor queda igual como autor', async () => {
      const subido = await subir(ana, { autor: beto.id })
      expect(idDe(subido.autor)).toBe(ana.id)
    })

    it('un usuario no puede cambiar el autor de su archivo', async () => {
      await payload.update({
        collection: 'media',
        id: deAna.id,
        data: { autor: beto.id },
        overrideAccess: false,
        user: ana,
      })
      const doc = await payload.findByID({ collection: 'media', id: deAna.id, depth: 0 })
      expect(doc.autor).toBe(ana.id)
    })

    it('un admin que sube sin indicar autor queda como autor', async () => {
      const subido = await subir(admin)
      expect(idDe(subido.autor)).toBe(admin.id)
    })

    it('un admin puede indicar otro autor al subir', async () => {
      const subido = await subir(admin, { autor: ana.id })
      expect(idDe(subido.autor)).toBe(ana.id)
    })

    it('un admin reasigna el autor', async () => {
      const actualizado = await payload.update({
        collection: 'media',
        id: deAna.id,
        data: { autor: beto.id },
        overrideAccess: false,
        user: admin,
        depth: 0,
      })
      expect(actualizado.autor).toBe(beto.id)
    })

    it('un usuario ve el nombre del autor de un archivo ajeno, sin email ni rol', async () => {
      const doc = await payload.findByID({
        collection: 'media',
        id: deBeto.id,
        depth: 1,
        overrideAccess: false,
        user: ana,
      })
      const autor = doc.autor as User
      expect(autor.nombre).toBe('Beto')
      expect(autor.email).toBeUndefined()
      expect(autor.role).toBeUndefined()
    })
  })

  describe('lectura y alta', () => {
    it('un usuario lista todos los archivos, incluidos los ajenos', async () => {
      const { docs } = await payload.find({
        collection: 'media',
        overrideAccess: false,
        user: ana,
      })
      expect(docs.map((d) => d.id).sort()).toEqual([deAna.id, deBeto.id, sinAutor.id].sort())
    })

    it('sin sesión no se pueden listar archivos', async () => {
      await expect(
        payload.find({ collection: 'media', overrideAccess: false }),
      ).rejects.toMatchObject({ status: 403 })
    })

    it('sin sesión no se puede pedir un archivo por id', async () => {
      await expect(
        payload.findByID({ collection: 'media', id: deAna.id, overrideAccess: false }),
      ).rejects.toMatchObject({ status: 403 })
    })

    it('sin sesión no se puede subir un archivo', async () => {
      await expect(subir(undefined)).rejects.toMatchObject({ status: 403 })
    })
  })

  describe('edición y borrado', () => {
    it('un usuario edita su propio archivo', async () => {
      const actualizado = await payload.update({
        collection: 'media',
        id: deAna.id,
        data: { alt: 'Torta de chocolate' },
        overrideAccess: false,
        user: ana,
      })
      expect(actualizado.alt).toBe('Torta de chocolate')
    })

    it('un usuario borra su propio archivo', async () => {
      await payload.delete({ collection: 'media', id: deAna.id, overrideAccess: false, user: ana })
      const { totalDocs } = await payload.count({
        collection: 'media',
        where: { id: { equals: deAna.id } },
      })
      expect(totalDocs).toBe(0)
    })

    for (const caso of ['ajeno', 'sin autor'] as const) {
      it(`un usuario no puede editar ni borrar un archivo ${caso}`, async () => {
        const objetivo = caso === 'ajeno' ? deBeto : sinAutor
        await expect(
          payload.update({
            collection: 'media',
            id: objetivo.id,
            data: { alt: 'Cambiado' },
            overrideAccess: false,
            user: ana,
          }),
        ).rejects.toBeTruthy()
        await expect(
          payload.delete({ collection: 'media', id: objetivo.id, overrideAccess: false, user: ana }),
        ).rejects.toBeTruthy()

        const doc = await payload.findByID({ collection: 'media', id: objetivo.id })
        expect(doc.alt).toBe(objetivo.alt)
      })
    }

    it('un admin borra cualquier archivo, incluido uno sin autor', async () => {
      for (const id of [deBeto.id, sinAutor.id]) {
        await payload.delete({ collection: 'media', id, overrideAccess: false, user: admin })
      }
      const { totalDocs } = await payload.count({ collection: 'media' })
      expect(totalDocs).toBe(1)
    })
  })

  describe('autor borrado', () => {
    it('al borrar un usuario, sus archivos quedan sin autor y solo un admin puede tocarlos', async () => {
      await payload.delete({ collection: 'users', id: beto.id, overrideAccess: false, user: admin })

      const doc = await payload.findByID({ collection: 'media', id: deBeto.id, depth: 0 })
      expect(doc.autor ?? null).toBeNull()

      await expect(
        payload.delete({ collection: 'media', id: deBeto.id, overrideAccess: false, user: ana }),
      ).rejects.toBeTruthy()
    })
  })
})
