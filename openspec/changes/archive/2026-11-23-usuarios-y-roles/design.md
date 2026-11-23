# Design

## Context

Proyecto Payload CMS 3.93 sobre Next.js 16 con Postgres (`@payloadcms/db-postgres`). Recién salido de la plantilla en blanco:

- `src/collections/Users.ts`: `auth: true`, sin campos propios ni reglas de acceso (Payload por defecto exige sesión para todo).
- `src/collections/Media.ts`: `read: () => true` (lectura pública), el resto con el default (cualquier usuario autenticado).
- No hay directorio `src/migrations/` todavía: el esquema se aplica con el modo `push` del adaptador en desarrollo.
- Tests: Vitest de integración (`tests/int/`) y Playwright e2e (`tests/e2e/`), con `tests/helpers/seedUser.ts` creando `dev@payloadcms.com`.

Motivación y alcance: ver proposal.md. Requisitos: ver `specs/usuarios/spec.md` y `specs/control-de-acceso/spec.md`.

## Goals / Non-Goals

**Goals:**
- Reglas de acceso declaradas en la configuración de Payload, para que valgan igual en panel, REST, GraphQL y Local API con `overrideAccess: false`.
- Helpers de acceso pequeños y reutilizables para la futura colección de recetas.
- Que un cambio de rol tenga efecto en la siguiente petición del usuario (Payload recarga el usuario desde la base en cada petición autenticada, así que `req.user.role` siempre está al día).

**Non-Goals:**
- Sistema de permisos configurable desde la UI (roles fijos en código).
- Múltiples roles por usuario: "cada usuario edita lo suyo" se resuelve con un campo autor por documento, no con roles combinados.
- Interfaz para el rol `usuario`: queda bloqueado del panel y su interfaz llega con el frontend.

## Decisions

### 1. Dos roles, un solo campo `role` (select simple)
`select` con `hasMany: false`, `required: true`, `defaultValue: 'usuario'`, opciones `admin | usuario`.
- Por qué dos roles: la única diferencia real de permisos es "administra el sistema" contra "participa". Leer todo y editar solo lo propio no necesita un rol aparte; lo resuelve el campo autor (decisión 5).
- Alternativa descartada: tres roles (`admin`, `editor`, `lector`). Sin panel para no-admins, `editor` y `lector` solo se diferenciaban en poder crear, y eso no hace falta en un recetario entre conocidos.
- Alternativa descartada: `roles` con `hasMany` (patrón de los ejemplos de Payload): agrega combinaciones sin sentido.
- Sin `saveToJWT`: la estrategia JWT de Payload 3.93 vuelve a leer el usuario de la base en cada petición (`payload.findByID` en `auth/strategies/jwt`), así que copiar el rol al token no ahorra consultas. Se puede agregar más adelante si el frontend necesita leer el rol del token.

### 2. Helpers en `src/access/`
- `ROLES` y `checkRole(roles, user)`: una sola fuente de verdad de los nombres de rol, usada para las opciones del campo y para los helpers.
- `isAdmin`, `isAuthenticated`: funciones `Access` booleanas.
- `isAdminOrSelf`: `true` para admin; para el resto devuelve el `Where` `{ id: { equals: user.id } }`; `false` sin sesión.
- `isAdminOrAuthor(field = 'autor')`: `true` para admin; para `usuario` devuelve el `Where` `{ [field]: { equals: user.id } }`; `false` sin sesión.
- `isAdminFieldLevel`: `FieldAccess` booleano para escribir los campos `role` y `autor`.
- `isAdminOrSelfFieldLevel`: `FieldAccess` de lectura para `email` y `role`: `true` para admin; `true` si `doc?.id === user.id`; `false` en cualquier otro caso, **incluido cuando no hay `doc`**. Payload evalúa los permisos de campo sin documento al validar filtros (`validateSearchParams`), así que devolver `false` sin `doc` es lo que impide a un `usuario` filtrar por email ajeno: recibe un error de consulta en vez de una respuesta.
- Por qué un `Where` y no un booleano: Payload aplica el filtro en la consulta, así un usuario no puede operar sobre un documento ajeno ni apuntándolo por id.
- Las recetas reutilizarán `isAuthenticated` e `isAdminOrAuthor` tal cual.

### 3. Reglas de `users`
| Operación | Regla |
|-----------|-------|
| `admin` (acceso al panel) | `isAdmin` |
| `create` | `isAdmin` |
| `read` | `isAuthenticated` (todas las cuentas; los campos sensibles se filtran abajo) |
| `update` | `isAdminOrSelf` |
| `delete` | `isAdmin` |
| `unlock` | `isAdmin` (sin esto Payload lo permite a cualquier usuario autenticado) |
| campo `nombre` | `text`, `required`, sin restricción de lectura; `admin.useAsTitle: 'nombre'` |
| campo `email`: `read` | `isAdminOrSelfFieldLevel` |
| campo `role`: `read` | `isAdminOrSelfFieldLevel` |
| campo `role`: `create`/`update` | `isAdminFieldLevel` |

`read` pasa de `isAdminOrSelf` a `isAuthenticated` para que el nombre del autor se pueda mostrar: al poblar una relación (`autor` con `depth` ≥ 1), Payload aplica el `read` de `users`; con `isAdminOrSelf` un `usuario` vería solo el id del autor ajeno.

`email` es un campo que Payload agrega solo a las colecciones con `auth`. Para darle acceso de lectura se declara en `fields` un campo `{ name: 'email', type: 'email', access: { read: isAdminOrSelfFieldLevel } }`; Payload lo combina con el campo base (`mergeBaseFields`) y conserva su configuración de login. El login y `/api/users/me` no se ven afectados: el login busca por email sin pasar por el acceso de campo, y `me` devuelve la cuenta propia.

Con acceso a nivel de campo en `false`, Payload descarta el valor enviado en silencio: el usuario que intenta auto-promoverse conserva su rol (coincide con el escenario de la spec) en vez de recibir un error.

El acceso al panel se define con `access.admin` de la colección de usuarios (la que usa `admin.user`). Con `false`, Payload deja que un `usuario` se autentique por la API (`/api/users/login`), pero el panel le muestra la pantalla de "no autorizado". La API sigue respondiéndole según `read`/`create`/`update`/`delete`, lo que deja listo el camino para el frontend.

### 4. Primer usuario como admin: hook `beforeChange`
En `operation === 'create'`, si `payload.count({ collection: 'users' })` da 0, forzar `data.role = 'admin'`.
- Por qué un hook y no confiar en el `defaultValue`: la pantalla "create first user" de Payload no muestra campos restringidos por acceso; sin el hook el primer usuario quedaría `usuario` y nadie podría administrar.
- El endpoint de primer registro de Payload solo funciona cuando no hay usuarios, así que `create: isAdmin` no lo bloquea.

### 5. `media` y el campo autor
- Campo `autor`: `relationship` a `users`, opcional en la base (los archivos previos quedan sin autor), con acceso de campo `create`/`update: isAdminFieldLevel` y en el panel en la barra lateral.
- Hook `beforeChange` **de la colección** en `create`: `data.autor = req.user.id` cuando quien crea no es admin, o cuando es admin y no indicó autor. Un `usuario` nunca elige autor.
- Por qué un hook de colección y no un hook del campo: Payload 3.93 aplica el acceso de campo en la etapa `beforeValidate` de los campos, después de los hooks `beforeValidate` del propio campo y antes de los hooks `beforeChange` de la colección. Un valor asignado en un hook del campo se descartaría para un `usuario` (sin acceso `create` al campo); uno asignado en el `beforeChange` de la colección se conserva.
- Reglas: `read: isAuthenticated`, `create: isAuthenticated`, `update/delete: isAdminOrAuthor('autor')`. Mantener `upload: true` y el campo `alt`.
- Con la lectura protegida, Payload también exige sesión para servir el archivo por `/api/media/file/...` (pasa por el access `read`). El frontend público no muestra imágenes hoy, así que no se rompe nada.
- El nombre `autor` y el hook se repetirán en recetas; si aparece una tercera colección, extraer un campo reutilizable `autorField()` en `src/fields/`.
- Si se borra un usuario, sus archivos quedan con `autor` vacío (comportamiento por defecto de Payload con Postgres) y solo un admin puede gestionarlos o reasignarlos.

### 6. Protección del último admin: marcar en los hooks de documento, verificar en `afterOperation`
- `beforeChange` (update) y `beforeDelete` solo anotan en `req.context` que la operación degrada o borra a un admin.
- `afterOperation` verifica una vez por operación, con los cambios hechos y la transacción abierta: si quedan 0 admins lanza `APIError` (400) y Payload revierte todo. Solo actúa en las cuatro operaciones de escritura: `afterOperation` también corre en lecturas, y la de `beforeDelete` comparte `req` con la operación masiva en curso.
- Antes de contar toma `pg_advisory_xact_lock`, que se libera al cerrar la transacción: de dos operaciones simultáneas, la segunda cuenta después de que la primera confirmó (`READ COMMITTED`).
- Por qué no verificar por documento: en las operaciones masivas Payload corre esos hooks en paralelo, así que todos ven la cantidad original de admins, y los errores por documento no impiden confirmar el resto.
- Por qué hooks y no access: el acceso decide *quién* puede operar; esta es una regla de integridad que aplica incluso a admins y necesita un mensaje explicativo, que el `false` de access no da.
- Alternativa descartada: trigger en Postgres. También cubriría escrituras fuera de Payload, pero el modo `push` no lo crearía y quedaría fuera de la configuración.

### 7. Migración de usuarios existentes
Crear la primera migración de Payload (`pnpm payload migrate:create usuarios_y_roles`), que agrega el enum/columna `role`, la columna `nombre`, la columna `autor_id` en `media` (nullable, sin rellenar) y ejecuta `UPDATE users SET role = 'admin', nombre = split_part(email, '@', 1)` para todas las filas existentes en ese momento. La restricción `NOT NULL` de `nombre` se aplica después del `UPDATE`, para no fallar con filas previas.
- Por qué todos a `admin`: hoy cualquier usuario existente fue creado por el dueño y tenía acceso total; degradarlos lo dejaría sin poder administrar.
- Alternativa descartada: script suelto en `src/scripts/`. La migración queda versionada y se aplica igual en cada entorno.

### 8. Tests
- Base de datos de tests separada: hoy `vitest.setup.ts` carga `.env` (la misma base de desarrollo) y los tests de primer admin y último admin necesitan vaciar la tabla `users`. Se agrega un `.env.test` con otro `DATABASE_URL` (otra base en el mismo Postgres de `docker-compose.yml`), cargado por Vitest y Playwright, y un guard que aborta si apunta a la base de algún entorno de desarrollo (compara servidor, puerto y base, no el texto) o si el nombre de la base no incluye `test`.
- Archivos de tests separados: `media` toma su carpeta de `MEDIA_DIR` (por defecto `media`); los tests usan `media-test`, que se borra al empezar y al terminar.
- `seedTestUser` crea el usuario de prueba con `role: 'admin'` (los e2e del panel siguen funcionando).
- Tests por los handlers HTTP (REST y GraphQL) para lo que la Local API no recorre: GraphQL, descarga de archivos, alta inicial, desbloqueo y operaciones masivas. La migración se prueba sobre una base descartable con datos previos.
- Tests de integración con Local API `overrideAccess: false, user` que cubren los escenarios de ambas specs, incluidos primer admin, último admin y la regla de autor.
- E2e mínimo: un `usuario` inicia sesión en `/admin` y ve la pantalla de no autorizado; un admin entra y ve el campo Rol al editar un usuario.

## Risks / Trade-offs

- [El rol `usuario` no tiene interfaz hasta que exista el frontend: hoy solo puede usar la API] → Aceptado y explícito en la propuesta. Mientras tanto, el admin carga el contenido desde el panel.
- [Lectura de `media` deja de ser pública] → Aceptado por ser un recetario privado; si el frontend público necesita imágenes sin sesión, se agrega una regla específica en ese cambio.
- [Cualquier usuario autenticado puede listar todas las cuentas (con nombre e id)] → Aceptado: es un recetario privado entre conocidos y el nombre es justamente lo que se quiere mostrar. Email y rol quedan ocultos.
- [Un campo nuevo agregado a `users` en el futuro será visible para todos los usuarios si no se le pone acceso de lectura] → Documentarlo en el README (tarea 5.2) y cubrir con un test que la respuesta de otra cuenta solo trae `id`, `nombre` y fechas.
- [Archivos de media previos sin autor quedan solo en manos del admin] → El admin puede reasignar el autor desde el panel; con pocos archivos no hace falta un relleno automático.
- [En desarrollo, el modo `push` agrega la columna con default `usuario` antes de correr la migración, y los usuarios existentes quedarían como `usuario`] → Correr `pnpm payload migrate` justo después del primer arranque; el `UPDATE` de la migración los deja en `admin`. Alternativa de rescate: crear un admin con la Local API.
- [La protección del último admin depende de la transacción: no cubre código propio que use `disableTransaction` ni escrituras directas en la base] → Aceptado: las API REST y GraphQL siempre usan transacción; solo aplica a código de servidor de confianza.
- [Si la base de desarrollo ya fue modificada con `push`, `pnpm payload migrate` pide confirmación interactiva] → Responder que sí en desarrollo; en entornos nuevos la migración corre sin preguntar.

## Migration Plan

1. Desplegar el código con la migración.
2. Ejecutar `pnpm payload migrate` (agrega `role` y la columna de autor, y promueve a `admin` a los usuarios existentes).
3. Regenerar tipos (`pnpm generate:types`).
4. Verificar en `/admin` que el usuario dueño tiene rol `admin`.

Rollback: `pnpm payload migrate:down` elimina la columna/enum `role` y la columna de autor en `media`, y revertir el código vuelve a las reglas por defecto (todo usuario autenticado puede todo, `media` pública).
