// @vitest-environment node
// (jose, usado por el login de Payload, falla bajo jsdom)
import { getPayload, type Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

import { crearUsuario, resetDb } from '../helpers/db'

let payload: Payload

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

describe('usuarios', () => {
  let admin: User
  let ana: User
  let beto: User

  beforeEach(async () => {
    await resetDb(payload)
    admin = await crearUsuario(payload, { nombre: 'Admin', role: 'admin' })
    ana = await crearUsuario(payload, { nombre: 'Ana' })
    beto = await crearUsuario(payload, { nombre: 'Beto' })
  })

  describe('alta de usuarios', () => {
    it('un admin crea un usuario con el rol indicado', async () => {
      const nuevo = await payload.create({
        collection: 'users',
        data: { nombre: 'Carla', email: 'carla@test.local', password: 'clave-segura', role: 'admin' },
        overrideAccess: false,
        user: admin,
      })
      expect(nuevo.role).toBe('admin')
      expect(nuevo.nombre).toBe('Carla')
    })

    it('sin rol explícito el usuario queda como usuario', async () => {
      const nuevo = await payload.create({
        collection: 'users',
        data: { nombre: 'Dani', email: 'dani@test.local', password: 'clave-segura' } as never,
        overrideAccess: false,
        user: admin,
      })
      expect(nuevo.role).toBe('usuario')
    })

    it('rechaza un alta sin nombre', async () => {
      await expect(
        payload.create({
          collection: 'users',
          data: { email: 'sin-nombre@test.local', password: 'clave-segura' } as never,
          overrideAccess: false,
          user: admin,
        }),
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rechaza un rol inválido', async () => {
      await expect(
        payload.create({
          collection: 'users',
          data: {
            nombre: 'Eva',
            email: 'eva@test.local',
            password: 'clave-segura',
            role: 'superadmin' as never,
          },
          overrideAccess: false,
          user: admin,
        }),
      ).rejects.toMatchObject({ status: 400 })
    })

    it('un usuario no puede crear cuentas', async () => {
      await expect(
        payload.create({
          collection: 'users',
          data: { nombre: 'Fede', email: 'fede@test.local', password: 'clave-segura' } as never,
          overrideAccess: false,
          user: ana,
        }),
      ).rejects.toMatchObject({ status: 403 })
    })

    it('sin sesión no se puede crear una cuenta', async () => {
      await expect(
        payload.create({
          collection: 'users',
          data: { nombre: 'Gabi', email: 'gabi@test.local', password: 'clave-segura' } as never,
          overrideAccess: false,
        }),
      ).rejects.toMatchObject({ status: 403 })
    })
  })

  describe('visibilidad de cuentas', () => {
    it('un admin ve nombre, email y rol de todas las cuentas', async () => {
      const { docs } = await payload.find({
        collection: 'users',
        overrideAccess: false,
        user: admin,
      })
      expect(docs).toHaveLength(3)
      for (const doc of docs) {
        expect(doc.nombre).toBeTruthy()
        expect(doc.email).toBeTruthy()
        expect(doc.role).toBeTruthy()
      }
    })

    it('un usuario ve todas las cuentas, pero de las ajenas solo id, nombre y fechas', async () => {
      const { docs } = await payload.find({
        collection: 'users',
        overrideAccess: false,
        user: ana,
      })
      expect(docs).toHaveLength(3)

      const propia = docs.find((d) => d.id === ana.id)!
      expect(propia.email).toBe(ana.email)
      expect(propia.role).toBe('usuario')

      for (const ajena of docs.filter((d) => d.id !== ana.id)) {
        // Cualquier campo nuevo en `users` sin `access.read` aparecería acá.
        // Payload agrega `collection` (etiqueta) y deja `sessions` como lista vacía
        // cuando el lector no es el titular: se aceptan, pero sin datos.
        const { collection: _collection, sessions, ...resto } = ajena as typeof ajena & {
          collection?: string
        }
        expect(sessions ?? []).toEqual([])
        expect(Object.keys(resto).sort()).toEqual(['createdAt', 'id', 'nombre', 'updatedAt'])
      }
    })

    it('un usuario que pide otra cuenta por id ve el nombre sin email ni rol', async () => {
      const doc = await payload.findByID({
        collection: 'users',
        id: beto.id,
        overrideAccess: false,
        user: ana,
      })
      expect(doc.nombre).toBe('Beto')
      expect(doc.email).toBeUndefined()
      expect(doc.role).toBeUndefined()
    })

    it('un usuario no puede filtrar por email', async () => {
      await expect(
        payload.find({
          collection: 'users',
          where: { email: { equals: beto.email } },
          overrideAccess: false,
          user: ana,
        }),
      ).rejects.toMatchObject({ status: 400 })
    })

    it('un admin sí puede filtrar por email', async () => {
      const { docs } = await payload.find({
        collection: 'users',
        where: { email: { equals: beto.email } },
        overrideAccess: false,
        user: admin,
      })
      expect(docs.map((d) => d.id)).toEqual([beto.id])
    })

    it('sin sesión no se ve ninguna cuenta', async () => {
      await expect(
        payload.find({ collection: 'users', overrideAccess: false }),
      ).rejects.toMatchObject({ status: 403 })
    })
  })

  describe('edición de cuentas', () => {
    it('un usuario cambia su propio nombre', async () => {
      const actualizado = await payload.update({
        collection: 'users',
        id: ana.id,
        data: { nombre: 'Ana María' },
        overrideAccess: false,
        user: ana,
      })
      expect(actualizado.nombre).toBe('Ana María')
    })

    it('un usuario cambia su propia contraseña y puede entrar con la nueva', async () => {
      await payload.update({
        collection: 'users',
        id: ana.id,
        data: { password: 'nueva-clave' },
        overrideAccess: false,
        user: ana,
      })
      const login = await payload.login({
        collection: 'users',
        data: { email: ana.email, password: 'nueva-clave' },
      })
      expect(login.user?.id).toBe(ana.id)
    })

    it('un usuario no puede editar la cuenta de otra persona', async () => {
      await expect(
        payload.update({
          collection: 'users',
          id: beto.id,
          data: { nombre: 'Hackeado' },
          overrideAccess: false,
          user: ana,
        }),
      ).rejects.toBeTruthy()
      const sinCambios = await payload.findByID({ collection: 'users', id: beto.id })
      expect(sinCambios.nombre).toBe('Beto')
    })

    it('un admin edita cualquier cuenta', async () => {
      const actualizado = await payload.update({
        collection: 'users',
        id: beto.id,
        data: { nombre: 'Roberto' },
        overrideAccess: false,
        user: admin,
      })
      expect(actualizado.nombre).toBe('Roberto')
    })
  })

  describe('roles', () => {
    it('un usuario que intenta auto-promoverse conserva el rol usuario', async () => {
      await payload.update({
        collection: 'users',
        id: ana.id,
        data: { role: 'admin' },
        overrideAccess: false,
        user: ana,
      })
      const doc = await payload.findByID({ collection: 'users', id: ana.id })
      expect(doc.role).toBe('usuario')
    })

    it('un admin promueve a un usuario', async () => {
      const actualizado = await payload.update({
        collection: 'users',
        id: ana.id,
        data: { role: 'admin' },
        overrideAccess: false,
        user: admin,
      })
      expect(actualizado.role).toBe('admin')
    })
  })

  describe('borrado de cuentas', () => {
    it('un admin borra una cuenta', async () => {
      await payload.delete({
        collection: 'users',
        id: beto.id,
        overrideAccess: false,
        user: admin,
      })
      const { totalDocs } = await payload.count({
        collection: 'users',
        where: { id: { equals: beto.id } },
      })
      expect(totalDocs).toBe(0)
    })

    it('un usuario no puede borrar cuentas, ni la propia', async () => {
      for (const id of [beto.id, ana.id]) {
        await expect(
          payload.delete({ collection: 'users', id, overrideAccess: false, user: ana }),
        ).rejects.toMatchObject({ status: 403 })
      }
    })
  })

  describe('primer usuario', () => {
    it('el primer usuario creado queda como admin aunque se envíe otro rol', async () => {
      await resetDb(payload)
      // Igual que la pantalla "create first user" de Payload (registerFirstUser),
      // que crea el usuario saltando el control de acceso.
      const primero = await payload.create({
        collection: 'users',
        data: { nombre: 'Dueña', email: 'duena@test.local', password: 'clave-segura', role: 'usuario' },
        overrideAccess: true,
      })
      expect(primero.role).toBe('admin')

      const segundo = await crearUsuario(payload, { role: 'usuario' })
      expect(segundo.role).toBe('usuario')
    })
  })

  describe('último admin', () => {
    it('no se puede borrar al único admin', async () => {
      await expect(
        payload.delete({ collection: 'users', id: admin.id, overrideAccess: false, user: admin }),
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('al menos un usuario con rol admin') })
      const doc = await payload.findByID({ collection: 'users', id: admin.id })
      expect(doc.role).toBe('admin')
    })

    it('no se puede degradar al único admin', async () => {
      await expect(
        payload.update({
          collection: 'users',
          id: admin.id,
          data: { role: 'usuario' },
          overrideAccess: false,
          user: admin,
        }),
      ).rejects.toMatchObject({ status: 400 })
      const doc = await payload.findByID({ collection: 'users', id: admin.id })
      expect(doc.role).toBe('admin')
    })

    it('se puede degradar a un admin cuando hay otro', async () => {
      const otroAdmin = await crearUsuario(payload, { role: 'admin' })
      const actualizado = await payload.update({
        collection: 'users',
        id: otroAdmin.id,
        data: { role: 'usuario' },
        overrideAccess: false,
        user: admin,
      })
      expect(actualizado.role).toBe('usuario')
    })

    it('se puede borrar a un admin cuando hay otro', async () => {
      const otroAdmin = await crearUsuario(payload, { role: 'admin' })
      await payload.delete({
        collection: 'users',
        id: otroAdmin.id,
        overrideAccess: false,
        user: admin,
      })
      const { totalDocs } = await payload.count({
        collection: 'users',
        where: { role: { equals: 'admin' } },
      })
      expect(totalDocs).toBe(1)
    })
  })

  describe('último admin en operaciones masivas y simultáneas', () => {
    let otroAdmin: User

    const contarAdmins = async () => {
      const { totalDocs } = await payload.count({
        collection: 'users',
        where: { role: { equals: 'admin' } },
      })
      return totalDocs
    }

    beforeEach(async () => {
      otroAdmin = await crearUsuario(payload, { nombre: 'Otro admin', role: 'admin' })
    })

    it('no se puede borrar a todos los admins en una sola operación', async () => {
      await expect(
        payload.delete({
          collection: 'users',
          where: { role: { equals: 'admin' } },
          overrideAccess: false,
          user: admin,
        }),
      ).rejects.toMatchObject({ status: 400 })
      expect(await contarAdmins()).toBe(2)
    })

    it('un borrado masivo rechazado no borra a nadie, tampoco a los que no son admin', async () => {
      await expect(
        payload.delete({
          collection: 'users',
          where: { id: { exists: true } },
          overrideAccess: false,
          user: admin,
        }),
      ).rejects.toMatchObject({ status: 400 })
      const { totalDocs } = await payload.count({ collection: 'users' })
      expect(totalDocs).toBe(4)
    })

    it('no se puede degradar a todos los admins en una sola operación', async () => {
      await expect(
        payload.update({
          collection: 'users',
          where: { role: { equals: 'admin' } },
          data: { role: 'usuario' },
          overrideAccess: false,
          user: admin,
        }),
      ).rejects.toMatchObject({ status: 400 })
      expect(await contarAdmins()).toBe(2)
    })

    it('una operación masiva que deja un admin se permite', async () => {
      await payload.delete({
        collection: 'users',
        where: { id: { in: [otroAdmin.id, beto.id] } },
        overrideAccess: false,
        user: admin,
      })
      expect(await contarAdmins()).toBe(1)
    })

    // Varias vueltas: una carrera puede no darse en un único intento.
    for (const accion of ['degradar', 'borrar', 'degradar y borrar'] as const) {
      it(`dos pedidos simultáneos no dejan al sistema sin admins (${accion})`, async () => {
        const degradar = (id: number) =>
          payload.update({
            collection: 'users',
            id,
            data: { role: 'usuario' },
            overrideAccess: false,
            user: admin,
          })
        const borrar = (id: number) =>
          payload.delete({ collection: 'users', id, overrideAccess: false, user: admin })

        for (let vuelta = 0; vuelta < 5; vuelta += 1) {
          await payload.db.deleteMany({ collection: 'users', where: {} })
          const a = await crearUsuario(payload, { role: 'admin' })
          const b = await crearUsuario(payload, { role: 'admin' })
          const resultados = await Promise.allSettled([
            accion === 'borrar' ? borrar(a.id) : degradar(a.id),
            accion === 'degradar' ? degradar(b.id) : borrar(b.id),
          ])
          expect(resultados.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected'])
          expect(await contarAdmins()).toBe(1)
        }
      })
    }
  })

  describe('desbloqueo de cuentas', () => {
    beforeEach(async () => {
      await payload.db.updateOne({
        collection: 'users',
        id: beto.id,
        data: { loginAttempts: 5, lockUntil: new Date(Date.now() + 600_000).toISOString() },
      })
    })

    const desbloquear = (user: User) =>
      payload.unlock({
        collection: 'users',
        data: { email: beto.email, password: '' },
        overrideAccess: false,
        req: { user: { ...user, collection: 'users' } },
      })

    const estaBloqueado = async () => {
      const doc = await payload.db.findOne<User>({
        collection: 'users',
        where: { id: { equals: beto.id } },
      })
      return Boolean(doc?.lockUntil)
    }

    it('un usuario no puede desbloquear la cuenta de otra persona', async () => {
      await expect(desbloquear(ana)).rejects.toMatchObject({ status: 403 })
      expect(await estaBloqueado()).toBe(true)
    })

    it('un admin desbloquea una cuenta', async () => {
      await desbloquear(admin)
      expect(await estaBloqueado()).toBe(false)
    })
  })

  describe('cambio de rol con sesión abierta', () => {
    it('un usuario promovido a admin tiene permisos de admin en su siguiente petición', async () => {
      const { token } = await payload.login({
        collection: 'users',
        data: { email: ana.email, password: 'clave-de-prueba' },
      })
      const headers = new Headers({ Authorization: `JWT ${token}` })

      const antes = await payload.auth({ headers })
      expect(antes.user?.role).toBe('usuario')

      await payload.update({ collection: 'users', id: ana.id, data: { role: 'admin' } })

      // Mismo token, sin volver a iniciar sesión.
      const despues = await payload.auth({ headers })
      expect(despues.user?.role).toBe('admin')
      expect(despues.permissions.canAccessAdmin).toBe(true)
    })
  })
})
