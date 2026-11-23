import type { CollectionConfig } from 'payload'

import {
  checkRole,
  isAdmin,
  isAdminFieldLevel,
  isAdminOrSelf,
  isAdminOrSelfFieldLevel,
  isAuthenticated,
  ROLES,
} from '../access'
import {
  exigirAlMenosUnAdmin,
  marcarAdminBorrado,
  marcarAdminDegradado,
} from '../hooks/ultimoAdmin'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'nombre',
    defaultColumns: ['nombre', 'email', 'role'],
  },
  auth: true,
  access: {
    // Solo admin usa el panel; un `usuario` puede autenticarse por la API.
    admin: ({ req }) => checkRole(['admin'], req.user),
    create: isAdmin,
    // Todas las cuentas son visibles para quien tenga sesión (para mostrar el
    // nombre del autor); email y rol se filtran a nivel de campo.
    read: isAuthenticated,
    update: isAdminOrSelf,
    delete: isAdmin,
    // Desbloquear una cuenta bloqueada por intentos fallidos. Sin esto, Payload se lo
    // permite a cualquier usuario con sesión.
    unlock: isAdmin,
  },
  fields: [
    {
      name: 'nombre',
      type: 'text',
      required: true,
    },
    // Se combina con el campo `email` que Payload agrega por `auth: true`.
    // Todo campo nuevo de esta colección es visible para cualquier usuario
    // autenticado salvo que se le ponga `access.read`.
    {
      name: 'email',
      type: 'email',
      access: {
        read: isAdminOrSelfFieldLevel,
      },
    },
    {
      name: 'role',
      label: 'Rol',
      type: 'select',
      required: true,
      defaultValue: 'usuario',
      options: ROLES.map((role) => ({ label: role, value: role })),
      access: {
        read: isAdminOrSelfFieldLevel,
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
      admin: {
        position: 'sidebar',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation === 'create') {
          // El primer usuario del sistema siempre es admin.
          const { totalDocs } = await req.payload.count({ collection: 'users', req })
          if (totalDocs === 0) {
            data.role = 'admin'
          }
        }
        return data
      },
      marcarAdminDegradado,
    ],
    beforeDelete: [marcarAdminBorrado],
    afterOperation: [exigirAlMenosUnAdmin],
  },
}
