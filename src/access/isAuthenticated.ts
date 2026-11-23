import type { Access } from 'payload'

/** Cualquier usuario con sesión iniciada, sin importar su rol. */
export const isAuthenticated: Access = ({ req: { user } }) => Boolean(user)
