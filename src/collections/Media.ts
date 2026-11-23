import type { CollectionConfig } from 'payload'

import { checkRole, isAdminFieldLevel, isAdminOrAuthor, isAuthenticated } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    // El recetario es privado: hace falta sesión para ver o subir archivos.
    read: isAuthenticated,
    create: isAuthenticated,
    // Cada persona modifica y borra solo lo que subió; admin, todo.
    update: isAdminOrAuthor('autor'),
    delete: isAdminOrAuthor('autor'),
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'autor',
      type: 'relationship',
      relationTo: 'users',
      // Solo admin puede indicarlo o cambiarlo; para el resto lo asigna el hook.
      access: {
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
      // Hook de colección y no del campo: Payload descarta los valores de campos sin
      // acceso antes de los hooks `beforeChange` de la colección, así que asignarlo
      // acá es lo que hace que se conserve para un `usuario`.
      ({ data, operation, req }) => {
        if (operation === 'create' && req.user) {
          const esAdmin = checkRole(['admin'], req.user)
          if (!esAdmin || !data.autor) {
            data.autor = req.user.id
          }
        }
        return data
      },
    ],
  },
  upload: {
    // Los tests usan su propia carpeta (ver tests/helpers/loadTestEnv.ts).
    staticDir: process.env.MEDIA_DIR || 'media',
  },
}
