import type { Access, FieldAccess } from 'payload'

import { checkRole } from './roles'

/** Solo usuarios con rol `admin`. */
export const isAdmin: Access = ({ req: { user } }) => checkRole(['admin'], user)

/** Versión a nivel de campo: solo `admin` puede escribir (o leer) el campo. */
export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => checkRole(['admin'], user)
