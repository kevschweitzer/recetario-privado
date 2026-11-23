# Spec Delta

## Purpose

Gestiona las cuentas de usuario del recetario privado: su rol, quién puede darlas de alta, consultarlas, modificarlas y borrarlas, y garantiza que siempre exista al menos un administrador.

## ADDED Requirements

### Requirement: Cada usuario tiene un rol
Todo usuario SHALL tener exactamente un rol entre `admin` y `usuario`. Si al crear un usuario no se indica rol, el sistema MUST asignar `usuario`.

#### Scenario: Alta sin rol explícito
- **WHEN** un admin crea un usuario sin indicar rol
- **THEN** el usuario queda creado con rol `usuario`

#### Scenario: Rol inválido
- **WHEN** se intenta guardar un usuario con un rol distinto de `admin` o `usuario`
- **THEN** el sistema rechaza la operación con un error de validación

### Requirement: Cada usuario tiene un nombre
Todo usuario SHALL tener un nombre visible, obligatorio y no vacío, que lo identifica ante los demás usuarios (por ejemplo, como autor de contenido).

#### Scenario: Alta con nombre
- **WHEN** un admin crea un usuario con nombre "Ana" y un email
- **THEN** el usuario queda creado con nombre "Ana"

#### Scenario: Alta sin nombre
- **WHEN** se intenta crear un usuario sin nombre
- **THEN** el sistema rechaza la operación con un error de validación

#### Scenario: Usuarios existentes al migrar
- **GIVEN** un usuario creado antes de este cambio, sin nombre
- **WHEN** se aplica la migración
- **THEN** el usuario queda con un nombre derivado de su email (la parte anterior a `@`)

### Requirement: Primer usuario es administrador
Cuando no existe ningún usuario, la primera cuenta creada SHALL quedar con rol `admin`, sin importar el rol enviado.

#### Scenario: Alta del primer usuario
- **GIVEN** la base no tiene usuarios
- **WHEN** alguien crea el primer usuario desde la pantalla de alta inicial del panel
- **THEN** ese usuario queda con rol `admin`

### Requirement: Solo admin da de alta usuarios
Una vez que existe al menos un usuario, solo un usuario con rol `admin` SHALL poder crear usuarios. No existe registro público.

#### Scenario: Admin crea un usuario
- **WHEN** un admin crea un usuario con rol `usuario`
- **THEN** el usuario queda creado con rol `usuario`

#### Scenario: Usuario intenta crear una cuenta
- **WHEN** un usuario con rol `usuario` intenta crear otra cuenta
- **THEN** el sistema rechaza la operación por falta de permisos

#### Scenario: Visitante sin sesión intenta registrarse
- **GIVEN** ya existe al menos un usuario
- **WHEN** alguien sin sesión intenta crear un usuario
- **THEN** el sistema rechaza la operación por falta de permisos

### Requirement: Visibilidad de cuentas
Todo usuario autenticado SHALL poder ver el nombre de todas las cuentas. El email y el rol de una cuenta SHALL ser visibles solo para un admin y para el propio titular. Sin sesión no se ve ninguna cuenta.

#### Scenario: Admin lista usuarios
- **WHEN** un admin lista los usuarios
- **THEN** recibe todas las cuentas con nombre, email y rol

#### Scenario: Usuario lista usuarios
- **WHEN** un usuario con rol `usuario` lista los usuarios
- **THEN** recibe todas las cuentas con su nombre, pero el email y el rol solo aparecen en su propia cuenta

#### Scenario: Usuario consulta otra cuenta por identificador
- **WHEN** un usuario con rol `usuario` pide la cuenta de otra persona por su identificador
- **THEN** recibe su nombre, sin email ni rol

#### Scenario: Usuario busca por email ajeno
- **WHEN** un usuario con rol `usuario` filtra el listado de usuarios por email
- **THEN** el sistema no revela qué cuentas tienen ese email

#### Scenario: Sin sesión
- **WHEN** alguien sin sesión lista los usuarios
- **THEN** el sistema rechaza la operación por falta de permisos

### Requirement: Edición de la propia cuenta
Un usuario SHALL poder modificar los datos de su propia cuenta (nombre, email, contraseña). Un admin SHALL poder modificar cualquier cuenta. Un usuario con rol `usuario` MUST NOT poder modificar cuentas ajenas.

#### Scenario: Usuario cambia su contraseña
- **WHEN** un usuario con rol `usuario` cambia la contraseña de su propia cuenta
- **THEN** el cambio se guarda

#### Scenario: Usuario intenta editar otra cuenta
- **WHEN** un usuario con rol `usuario` intenta modificar la cuenta de otra persona
- **THEN** el sistema rechaza la operación por falta de permisos

### Requirement: Solo admin cambia roles
Solo un admin SHALL poder asignar o cambiar el rol de un usuario. Un usuario con rol `usuario` MUST NOT poder cambiar ningún rol, incluido el propio.

#### Scenario: Admin promueve a un usuario
- **WHEN** un admin cambia el rol de un usuario a `admin`
- **THEN** el usuario queda con rol `admin`

#### Scenario: Usuario intenta auto-promoverse
- **WHEN** un usuario con rol `usuario` envía una actualización de su propia cuenta con rol `admin`
- **THEN** su rol sigue siendo `usuario`

### Requirement: Solo admin borra usuarios
Solo un admin SHALL poder borrar usuarios.

#### Scenario: Admin borra un usuario
- **WHEN** un admin borra la cuenta de un usuario
- **THEN** la cuenta deja de existir

#### Scenario: Usuario intenta borrar una cuenta
- **WHEN** un usuario con rol `usuario` intenta borrar cualquier cuenta, incluida la propia
- **THEN** el sistema rechaza la operación por falta de permisos

### Requirement: Solo admin desbloquea cuentas
Solo un admin SHALL poder desbloquear una cuenta bloqueada por intentos fallidos de inicio de sesión.

#### Scenario: Admin desbloquea una cuenta
- **GIVEN** una cuenta bloqueada por intentos fallidos
- **WHEN** un admin la desbloquea
- **THEN** la cuenta deja de estar bloqueada

#### Scenario: Usuario intenta desbloquear una cuenta ajena
- **GIVEN** una cuenta bloqueada por intentos fallidos
- **WHEN** un usuario con rol `usuario` intenta desbloquearla
- **THEN** el sistema rechaza la operación por falta de permisos y la cuenta sigue bloqueada

### Requirement: Siempre existe al menos un admin
El sistema MUST rechazar cualquier operación que deje al sistema sin usuarios con rol `admin`, ya sea borrando al último admin o cambiándole el rol.

#### Scenario: Borrar al último admin
- **GIVEN** existe un único usuario con rol `admin`
- **WHEN** ese admin intenta borrar su propia cuenta
- **THEN** el sistema rechaza la operación con un mensaje que explica que debe quedar al menos un admin

#### Scenario: Degradar al último admin
- **GIVEN** existe un único usuario con rol `admin`
- **WHEN** ese admin intenta cambiar su propio rol a `usuario`
- **THEN** el sistema rechaza la operación y el rol sigue siendo `admin`

#### Scenario: Degradar a un admin cuando hay otro
- **GIVEN** existen dos usuarios con rol `admin`
- **WHEN** uno cambia el rol del otro a `usuario`
- **THEN** el cambio se guarda

#### Scenario: Operación masiva sobre todos los admins
- **GIVEN** existen dos usuarios con rol `admin`
- **WHEN** un admin borra, o cambia a rol `usuario`, a ambos en una sola operación
- **THEN** el sistema rechaza la operación completa y no modifica ninguna cuenta

#### Scenario: Operación masiva que conserva un admin
- **GIVEN** existen dos usuarios con rol `admin`
- **WHEN** un admin borra en una sola operación al otro admin y a otras cuentas
- **THEN** la operación se completa

#### Scenario: Operaciones simultáneas sobre los últimos admins
- **GIVEN** existen dos usuarios con rol `admin`
- **WHEN** se borra o degrada a cada uno en dos operaciones simultáneas
- **THEN** una se completa, la otra se rechaza y queda un admin
