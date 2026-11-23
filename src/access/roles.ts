/**
 * Roles del recetario. Única fuente de verdad de los nombres de rol:
 * se usa para las opciones del campo `role` de `users` y en los helpers de acceso.
 */
export const ROLES = ['admin', 'usuario'] as const

export type Role = (typeof ROLES)[number]

/** Cualquier objeto de usuario que pueda traer un rol (p. ej. `req.user`). */
type UserWithRole = { id: string | number; role?: string | null } | null | undefined

/**
 * Devuelve `true` si el usuario tiene alguno de los roles indicados.
 * Sin usuario, o sin rol, devuelve `false`.
 */
export const checkRole = (roles: readonly Role[], user: UserWithRole): boolean => {
  if (!user?.role) return false
  return (roles as readonly string[]).includes(user.role)
}
