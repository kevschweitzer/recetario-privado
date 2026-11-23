import type { Access, FieldAccess } from 'payload'

import { checkRole } from './roles'

/**
 * `admin` opera sobre cualquier cuenta; el resto, solo sobre la propia
 * (filtro por `id`, que Payload aplica en la consulta). Sin sesión: nada.
 */
export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (checkRole(['admin'], user)) return true
  return { id: { equals: user.id } }
}

/**
 * Lectura a nivel de campo: `admin` o el titular del documento.
 *
 * Devuelve `false` cuando no hay `doc`: Payload evalúa los permisos de campo sin
 * documento al validar filtros, y así un no-admin no puede filtrar por este campo
 * (p. ej. buscar a quién pertenece un email).
 */
export const isAdminOrSelfFieldLevel: FieldAccess = ({ req: { user }, doc }) => {
  if (!user) return false
  if (checkRole(['admin'], user)) return true
  if (!doc) return false
  return String(doc.id) === String(user.id)
}
