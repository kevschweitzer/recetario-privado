import type { Access } from 'payload'

import { checkRole } from './roles'

/**
 * `admin` opera sobre cualquier documento; el resto, solo sobre los que tienen
 * su id en el campo de autor (filtro que Payload aplica en la consulta, así que
 * los documentos sin autor o de otra persona quedan fuera). Sin sesión: nada.
 */
export const isAdminOrAuthor =
  (field = 'autor'): Access =>
  ({ req: { user } }) => {
    if (!user) return false
    if (checkRole(['admin'], user)) return true
    return { [field]: { equals: user.id } }
  }
