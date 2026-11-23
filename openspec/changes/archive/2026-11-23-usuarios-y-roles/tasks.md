# Tasks

## 0. Base de datos de tests

- [x] 0.1 Crear `.env.test` con un `DATABASE_URL` a una base de tests separada (y agregarlo a `.gitignore` si contiene secretos), hacer que `vitest.setup.ts` y `playwright.config.ts` lo carguen en lugar de `.env`, y agregar un guard que aborte si coincide con el `DATABASE_URL` de `.env`; verificar que `pnpm test:int` corre contra la base de tests y que los usuarios de la base de desarrollo no cambian
- [x] 0.2 Comparar servidor, puerto y base (no el texto) contra todos los `.env` de desarrollo y exigir `test` en el nombre de la base; verificar con `tests/int/load-test-env.int.spec.ts`
- [x] 0.3 Guardar los archivos de los tests en `media-test` (`MEDIA_DIR`) y borrarla al empezar y terminar; verificar que `pnpm test:int` no agrega archivos a `media/`

## 1. Helpers de acceso

- [x] 1.1 Crear `src/access/roles.ts` con la constante `ROLES` (`admin`, `usuario`), el tipo `Role` y `checkRole(roles, user)`; verificar con `pnpm exec tsc --noEmit` sin errores
- [x] 1.2 Crear en `src/access/` `isAdmin`, `isAuthenticated`, `isAdminOrSelf` (devuelve `Where` por `id` para no-admin), `isAdminOrAuthor(field)` (devuelve `Where` por autor para no-admin), `isAdminFieldLevel` e `isAdminOrSelfFieldLevel` (devuelve `false` si no hay `doc`), con un `index.ts` que los reexporte; agregar `tests/int/access-helpers.int.spec.ts` con casos para admin, usuario y sin sesión, y verificar que `pnpm test:int` pasa

## 2. Rol en usuarios y reglas de la colección

- [x] 2.1 Agregar a `src/collections/Users.ts` el campo `nombre` (text, `required`, `admin.useAsTitle: 'nombre'`), el campo `role` (select, `required`, `defaultValue: 'usuario'`, opciones desde `ROLES`, lectura con `isAdminOrSelfFieldLevel`, `create`/`update` con `isAdminFieldLevel`) y la redeclaración de `email` con lectura `isAdminOrSelfFieldLevel`; mostrar nombre, email y rol como columnas en el listado del panel; verificar que `pnpm generate:types` agrega `nombre: string` y `role: 'admin' | 'usuario'` a `User` en `src/payload-types.ts`, y que el login en `/admin` sigue funcionando
- [x] 2.2 Configurar `access` en `Users` (`admin: isAdmin`, `create: isAdmin`, `read: isAuthenticated`, `update: isAdminOrSelf`, `delete: isAdmin`); verificar con tests de integración en `tests/int/usuarios.int.spec.ts` (Local API, `overrideAccess: false`) que cubren alta solo por admin, alta sin nombre rechazada, alta sin sesión rechazada, visibilidad (admin ve nombre, email y rol de todos; un usuario ve todas las cuentas pero en las ajenas solo `id`, `nombre` y fechas; filtrar por `email` como usuario da error de consulta), edición del propio nombre, edición propia, edición ajena rechazada, borrado solo por admin y usuario que intenta auto-promoverse conserva `usuario`
- [x] 2.3 Agregar hook `beforeChange` que fuerza `role: 'admin'` cuando se crea el primer usuario; verificar con un test que, con la tabla vacía, el primer `create` enviado con `role: 'usuario'` queda `admin`
- [x] 2.4 Proteger al último admin con `src/hooks/ultimoAdmin.ts` (marcar en `beforeChange`/`beforeDelete`, verificar en `afterOperation` con lock y `APIError` 400); verificar con tests: borrar o degradar al único admin falla, degradar a un admin cuando hay dos funciona, las operaciones masivas sobre todos los admins se rechazan enteras, dos operaciones simultáneas dejan un admin; y que un usuario promovido a `admin` obtiene permisos de admin en su siguiente petición sin volver a iniciar sesión
- [x] 2.5 Actualizar `tests/helpers/seedUser.ts` para crear el usuario de prueba con `role: 'admin'` y un `nombre` y verificar que `pnpm test:e2e` (admin.e2e) sigue pasando
- [x] 2.6 Agregar `unlock: isAdmin` en `Users`; verificar con tests que un usuario recibe 403 y la cuenta sigue bloqueada, y que un admin la desbloquea

## 3. Permisos de contenido y autor en media

- [x] 3.1 Agregar a `src/collections/Media.ts` el campo `autor` (relación a `users`, opcional, acceso de campo `isAdminFieldLevel`, en la barra lateral del panel) y el hook `beforeChange` que asigna `req.user` como autor al crear (siempre para `usuario`; para admin solo si no indicó otro); verificar con tests en `tests/int/media.int.spec.ts`: el archivo de un usuario queda con él como autor, un usuario que envía otro autor queda igual como autor, un admin puede reasignar el autor
- [x] 3.2 Configurar `access` en `Media` (`read`/`create: isAuthenticated`, `update`/`delete: isAdminOrAuthor('autor')`); verificar con tests en `tests/int/media.int.spec.ts`: usuario lista todos los medios, sin sesión rechazado en lectura y alta, usuario edita y borra su archivo, usuario no puede editar ni borrar uno ajeno ni uno sin autor, admin borra cualquiera, y un usuario que consulta un archivo ajeno con `depth: 1` recibe el `nombre` del autor sin su `email` ni su `role`
- [x] 3.3 Verificar por la API REST que un usuario autenticado puede hacer `POST /api/media` y recibe un rechazo al hacer `DELETE /api/media/:id` sobre un archivo ajeno (test de integración o e2e con `request` de Playwright)
- [x] 3.4 Agregar `tests/int/http.int.spec.ts` (GraphQL, descarga de archivos sin sesión, emails no filtrables ni ordenables, alta inicial real); verificar que `pnpm test:int` pasa

## 4. Migración de base de datos

- [x] 4.1 Crear la migración con `pnpm payload migrate:create usuarios_y_roles`, revisar que agrega el enum y la columna `role` y la columna `nombre` en `users` y la columna de autor (nullable) en `media`, y ajustar `up` para que ejecute `UPDATE users SET role = 'admin', nombre = split_part(email, '@', 1)` antes de aplicar `NOT NULL` a `nombre` (y en `down` la eliminación); verificar corriendo `pnpm payload migrate` sobre una base con un usuario y un archivo previos y comprobando que el usuario queda `admin` con nombre derivado del email y el archivo sin autor
- [x] 4.2 Verificar `pnpm payload migrate:down` seguido de `pnpm payload migrate` sobre una base de desarrollo sin errores
- [x] 4.3 Agregar `tests/int/migracion.int.spec.ts`, que migra una base descartable con un usuario y un archivo previos; verificar que `pnpm test:int` pasa

## 5. Panel e integración

- [x] 5.1 Agregar `tests/e2e/roles.e2e.spec.ts`: un `usuario` inicia sesión en `/admin` y ve la pantalla de no autorizado; un admin entra, ve el campo Rol al editar un usuario y el campo Autor al editar un archivo; verificar que `pnpm test:e2e` pasa
- [x] 5.2 Documentar en `README.md` los dos roles, qué puede hacer cada uno (incluida la regla de autor, qué datos de una cuenta ven los demás, que todo campo nuevo en `users` necesita acceso de lectura explícito si no debe ser público para los usuarios, y que el rol `usuario` todavía no tiene interfaz), cómo se crea el primer admin y el paso de migración; verificar que los comandos documentados funcionan tal como están escritos
- [x] 5.3 Correr `pnpm lint`, `pnpm exec tsc --noEmit` y `pnpm test` completos y verificar que todo pasa
- [x] 5.4 Volver a correr `pnpm lint`, `pnpm exec tsc --noEmit` y `pnpm test` (incluidos los e2e) después de las correcciones y verificar que todo pasa
