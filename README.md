# Payload Blank Template

This template comes configured with the bare minimum to get started on anything you need.

## Quick start

This template can be deployed directly from our Cloud hosting and it will setup MongoDB and cloud S3 object storage for media.

## Quick Start - local setup

To spin up this template locally, follow these steps:

### Clone

After you click the `Deploy` button above, you'll want to have standalone copy of this repo on your machine. If you've already cloned this repo, skip to [Development](#development).

### Development

1. First [clone the repo](#clone) if you have not done so already
2. `cd my-project && cp .env.example .env` to copy the example environment variables. You'll need to add the `MONGODB_URL` from your Cloud project to your `.env` if you want to use S3 storage and the MongoDB database that was created for you.

3. `pnpm install && pnpm dev` to install dependencies and start the dev server
4. open `http://localhost:3000` to open the app in your browser

That's it! Changes made in `./src` will be reflected in your app. Follow the on-screen instructions to login and create your first admin user. Then check out [Production](#production) once you're ready to build and serve your app, and [Deployment](#deployment) when you're ready to go live.

#### Docker (Optional)

If you prefer to use Docker for local development instead of a local MongoDB instance, the provided docker-compose.yml file can be used.

To do so, follow these steps:

- Modify the `MONGODB_URL` in your `.env` file to `mongodb://127.0.0.1/<dbname>`
- Modify the `docker-compose.yml` file's `MONGODB_URL` to match the above `<dbname>`
- Run `docker-compose up` to start the database, optionally pass `-d` to run in the background.

## Usuarios y roles

El recetario es privado: todo requiere iniciar sesión. Cada usuario tiene un **nombre** y uno de dos **roles**:

| Acción | `admin` | `usuario` |
|---|:-:|:-:|
| Usar el panel `/admin` | ✅ | ❌ |
| Ver todo el contenido (imágenes; recetas en el futuro) | ✅ | ✅ |
| Crear contenido | ✅ | ✅ |
| Editar / borrar contenido | todo | solo lo que creó |
| Cambiar el autor de un contenido | ✅ | ❌ |
| Crear / borrar usuarios y cambiar roles | ✅ | ❌ |
| Editar su propia cuenta (nombre, email, contraseña) | ✅ | ✅ |

- **Autor:** al crear contenido se guarda quién lo creó, en el campo `autor`. Un `usuario` no puede elegirlo ni cambiarlo. El contenido sin autor (anterior a los roles, o de un usuario borrado) solo lo puede tocar un `admin`, que puede reasignarle un autor desde el panel.
- **Qué ven los demás de una cuenta:** cualquier usuario con sesión ve el **nombre** de todas las cuentas (por ejemplo, para mostrar quién escribió una receta). El **email** y el **rol** solo los ven un `admin` y el titular de la cuenta.
- **Campos nuevos en `users`:** cualquier campo que se agregue a `src/collections/Users.ts` es visible para **todos** los usuarios con sesión, salvo que se le ponga `access.read` (por ejemplo `isAdminOrSelfFieldLevel` de `src/access`). El test "un usuario ve todas las cuentas, pero de las ajenas solo id, nombre y fechas" falla si alguien se olvida.
- **El rol `usuario` todavía no tiene interfaz:** no entra al panel, y el sitio público aún no tiene login ni edición. Por ahora solo puede usar la API (`/api/users/login`, `/api/media`, …).
- **Siempre queda al menos un `admin`:** el sistema rechaza borrar o degradar al último, también en operaciones masivas o simultáneas.
- **Cuentas bloqueadas:** después de varios intentos fallidos de inicio de sesión, solo un `admin` puede desbloquear la cuenta.
- Las reglas viven en `src/access/` y se aplican igual en el panel, la API REST y GraphQL.

### Primer admin

Con la base vacía, abrí `http://localhost:3000/admin` y completá la pantalla de alta inicial. Ese primer usuario queda como `admin` automáticamente. Desde el panel crea al resto y les asigna el rol: no hay registro público.

## Base de datos y migraciones

La base es Postgres, en el `docker-compose.yml` de la carpeta superior (`Recetario privado - Prueba nextjs openspect`). Desde esa carpeta:

```bash
docker compose up -d
```

El esquema se versiona con migraciones de Payload en `src/migrations/`. Para crear o actualizar las tablas, desde `recetario-privado/`:

```bash
pnpm payload migrate
```

La migración `usuarios_y_roles` pasa a `admin` a los usuarios que ya existían, con un nombre tomado de su email (la parte antes de `@`), que pueden cambiar después.

Si la base de desarrollo ya fue modificada por el modo `push` de `pnpm dev`, `pnpm payload migrate` pide confirmación antes de seguir: en desarrollo, respondé que sí.

## Tests

Los tests usan **su propia base de datos y su propia carpeta de archivos** (`media-test/`, que se borra sola), nunca las de desarrollo: los tests de integración vacían las tablas `users` y `media`. También crean y borran una base descartable, `<base de tests>_migracion`.

1. Creá la base de tests (una sola vez), desde la carpeta superior:

   ```bash
   docker compose exec db psql -U postgres -c "CREATE DATABASE recetario_test"
   ```

2. Creá `recetario-privado/.env.test` (está en `.gitignore`) con el mismo `PAYLOAD_SECRET` que `.env` y otro `DATABASE_URL`:

   ```bash
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/recetario_test
   PAYLOAD_SECRET=<el mismo valor que en .env>
   ```

3. Corré los tests desde `recetario-privado/`:

   ```bash
   pnpm test:int   # integración (Vitest)
   pnpm test:e2e   # end-to-end (Playwright): levanta su propio servidor en el puerto 3000
   pnpm test       # ambos
   ```

Los tests abortan si falta `.env.test`, si apunta a la base de desarrollo o si el nombre de su base no incluye `test`. Para `pnpm test:e2e`, el puerto 3000 tiene que estar libre: si tenés `pnpm dev` corriendo, frenalo antes, así los tests no usan un servidor conectado a la base de desarrollo.

## How it works

The Payload config is tailored specifically to the needs of most websites. It is pre-configured in the following ways:

### Collections

See the [Collections](https://payloadcms.com/docs/configuration/collections) docs for details on how to extend this functionality.

- #### Users (Authentication)

  Users are auth-enabled collections. Only users with the `admin` role can use the admin panel: see [Usuarios y roles](#usuarios-y-roles).

  For additional help, see the official [Auth Example](https://github.com/payloadcms/payload/tree/3.x/examples/auth) or the [Authentication](https://payloadcms.com/docs/authentication/overview#authentication-overview) docs.

- #### Media

  This is the uploads enabled collection. It features pre-configured sizes, focal point and manual resizing to help you manage your pictures.

### Docker

Alternatively, you can use [Docker](https://www.docker.com) to spin up this template locally. To do so, follow these steps:

1. Follow [steps 1 and 2 from above](#development), the docker-compose file will automatically use the `.env` file in your project root
1. Next run `docker-compose up`
1. Follow [steps 4 and 5 from above](#development) to login and create your first admin user

That's it! The Docker instance will help you get up and running quickly while also standardizing the development environment across your teams.

## Questions

If you have any issues or questions, reach out to us on [Discord](https://discord.com/invite/payload) or start a [GitHub discussion](https://github.com/payloadcms/payload/discussions).
