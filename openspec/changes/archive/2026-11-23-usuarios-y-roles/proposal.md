# Proposal

## Why

El recetario es privado, pero hoy la colección `users` solo tiene autenticación: cualquier usuario autenticado puede crear, ver, editar y borrar a cualquier otro usuario y todo el contenido. Antes de agregar recetas necesitamos distinguir a quien administra el sistema de quienes participan, y garantizar que cada persona solo modifique lo que creó.

## What Changes

- Agregar un campo `role` a `users` con dos valores: `admin` y `usuario` (por defecto `usuario`).
- Solo un `admin` puede crear usuarios, borrarlos y asignar o cambiar roles. No hay registro público.
- El primer usuario creado en el sistema (pantalla "create first user" de Payload) queda como `admin` automáticamente.
- Agregar un campo obligatorio `nombre` a `users`, para que cada persona se identifique ante las demás (por ejemplo, como autor de una receta).
- Todo usuario autenticado ve el nombre de todas las cuentas; el email y el rol solo los ven un `admin` y el propio titular.
- Cada usuario puede editar su propia cuenta (nombre, email, contraseña) pero no su rol. `admin` ve y edita todas las cuentas.
- Protección para que el sistema nunca se quede sin `admin`: no se puede borrar ni degradar al último `admin`, tampoco con operaciones masivas o simultáneas.
- Solo un `admin` puede desbloquear cuentas bloqueadas por intentos fallidos (hoy puede cualquier usuario autenticado).
- Solo `admin` usa el panel `/admin`. Un `usuario` queda bloqueado del panel y, hasta que exista un frontend con login y edición (cambio futuro), opera solo por la API.
- El contenido registra a su autor. Un `usuario` lee todo el contenido, crea contenido nuevo, y modifica y borra solo lo que creó. Un `admin` modifica todo.
- Funciones de acceso reutilizables (`admin`, `autenticado`, `admin o el propio usuario`, `admin o autor`) para aplicarlas también a colecciones futuras (recetas).
- Aplicar estas reglas a `media`: campo autor, lectura y alta para cualquier usuario autenticado, edición y borrado para el autor o un `admin`.
- **BREAKING**: la lectura de `media` deja de ser pública y pasa a requerir sesión (hoy `read: () => true`).
- **BREAKING**: los usuarios que ya existen en la base se migran con rol `admin`, para que el dueño actual no pierda acceso, y con un `nombre` tomado de su email (la parte anterior a `@`), que pueden cambiar después.
- **BREAKING**: los archivos de `media` que ya existen quedan sin autor; solo un `admin` puede modificarlos o reasignarles autor.

Fuera de alcance: colección de recetas (usará la regla "admin o autor" en su propio cambio), frontend con login y edición para usuarios, invitaciones por email, múltiples roles por usuario.

## Capabilities

### New Capabilities
- `usuarios`: cuentas de usuario, su nombre y rol, qué datos de cada cuenta ve cada quien, quién puede crearlas, verlas, editarlas y borrarlas, alta del primer administrador y protección del último administrador.
- `control-de-acceso`: qué puede hacer cada rol sobre el contenido del recetario y el panel de administración, incluida la regla de que un usuario solo modifica el contenido del que es autor.

### Modified Capabilities
<!-- No hay specs existentes en openspec/specs/. -->

## Impact

- `src/collections/Users.ts`: campos `nombre` y `role`, reglas de acceso por cuenta y por campo, hooks de primer admin y último admin.
- `src/collections/Media.ts`: campo autor y reglas de acceso por rol y por autor.
- Nuevo directorio `src/access/` con helpers de acceso.
- `src/payload-types.ts`: regenerar tipos (`pnpm generate:types`).
- Base de datos Postgres: nuevas columnas `nombre` y `role` (enum) en `users`, migración de usuarios existentes a `admin` con nombre derivado del email, y nueva columna de autor (opcional) en `media`.
- Tests: `tests/helpers/seedUser.ts` debe crear el usuario de prueba como `admin`; nuevos tests de integración por rol y por autor.
