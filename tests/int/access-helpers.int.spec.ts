import { describe, expect, it } from 'vitest'

import {
  checkRole,
  isAdmin,
  isAdminFieldLevel,
  isAdminOrAuthor,
  isAdminOrSelf,
  isAdminOrSelfFieldLevel,
  isAuthenticated,
} from '@/access'

// Los helpers solo leen `req.user` (y `doc` a nivel de campo), así que alcanza
// con objetos mínimos; el cast evita armar un PayloadRequest completo.
const admin = { id: 1, role: 'admin' }
const usuario = { id: 2, role: 'usuario' }
const args = (user: unknown, extra: Record<string, unknown> = {}) =>
  ({ req: { user }, ...extra }) as never

describe('checkRole', () => {
  it('reconoce el rol del usuario', () => {
    expect(checkRole(['admin'], admin)).toBe(true)
    expect(checkRole(['admin'], usuario)).toBe(false)
    expect(checkRole(['admin', 'usuario'], usuario)).toBe(true)
  })

  it('devuelve false sin usuario o sin rol', () => {
    expect(checkRole(['admin'], null)).toBe(false)
    expect(checkRole(['admin'], undefined)).toBe(false)
    expect(checkRole(['admin'], { id: 3 })).toBe(false)
  })
})

describe('isAdmin / isAdminFieldLevel', () => {
  it('solo permite a admin', () => {
    expect(isAdmin(args(admin))).toBe(true)
    expect(isAdmin(args(usuario))).toBe(false)
    expect(isAdmin(args(null))).toBe(false)
    expect(isAdminFieldLevel(args(admin))).toBe(true)
    expect(isAdminFieldLevel(args(usuario))).toBe(false)
    expect(isAdminFieldLevel(args(null))).toBe(false)
  })
})

describe('isAuthenticated', () => {
  it('permite a cualquier usuario con sesión', () => {
    expect(isAuthenticated(args(admin))).toBe(true)
    expect(isAuthenticated(args(usuario))).toBe(true)
    expect(isAuthenticated(args(null))).toBe(false)
  })
})

describe('isAdminOrSelf', () => {
  it('admin opera sobre todo', () => {
    expect(isAdminOrSelf(args(admin))).toBe(true)
  })

  it('usuario queda filtrado a su propia cuenta', () => {
    expect(isAdminOrSelf(args(usuario))).toEqual({ id: { equals: 2 } })
  })

  it('sin sesión no permite nada', () => {
    expect(isAdminOrSelf(args(null))).toBe(false)
  })
})

describe('isAdminOrSelfFieldLevel', () => {
  it('admin lee el campo de cualquier cuenta, incluso sin doc', () => {
    expect(isAdminOrSelfFieldLevel(args(admin, { doc: { id: 2 } }))).toBe(true)
    expect(isAdminOrSelfFieldLevel(args(admin))).toBe(true)
  })

  it('usuario lee el campo solo en su propia cuenta', () => {
    expect(isAdminOrSelfFieldLevel(args(usuario, { doc: { id: 2 } }))).toBe(true)
    expect(isAdminOrSelfFieldLevel(args(usuario, { doc: { id: 1 } }))).toBe(false)
  })

  it('compara ids aunque lleguen con distinto tipo', () => {
    expect(isAdminOrSelfFieldLevel(args(usuario, { doc: { id: '2' } }))).toBe(true)
  })

  it('usuario sin doc (validación de filtros) no tiene acceso', () => {
    expect(isAdminOrSelfFieldLevel(args(usuario))).toBe(false)
  })

  it('sin sesión no tiene acceso', () => {
    expect(isAdminOrSelfFieldLevel(args(null, { doc: { id: 2 } }))).toBe(false)
  })
})

describe('isAdminOrAuthor', () => {
  it('admin opera sobre todo', () => {
    expect(isAdminOrAuthor()(args(admin))).toBe(true)
  })

  it('usuario queda filtrado a los documentos de los que es autor', () => {
    expect(isAdminOrAuthor()(args(usuario))).toEqual({ autor: { equals: 2 } })
  })

  it('acepta otro nombre de campo de autor', () => {
    expect(isAdminOrAuthor('creadoPor')(args(usuario))).toEqual({ creadoPor: { equals: 2 } })
  })

  it('sin sesión no permite nada', () => {
    expect(isAdminOrAuthor()(args(null))).toBe(false)
  })
})
