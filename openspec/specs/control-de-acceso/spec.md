# control-de-acceso Specification

## Purpose

Define qué puede hacer cada rol (`admin`, `usuario`) sobre el contenido del recetario y sobre el panel de administración, para que el contenido solo sea visible para usuarios autenticados y solo lo modifiquen sus autores o un administrador.

## Requirements

### Requirement: Acceso al panel de administración
Solo usuarios con rol `admin` SHALL poder usar el panel de administración. Un usuario con rol `usuario` MUST NOT poder usarlo, aunque sus credenciales sean válidas.

#### Scenario: Admin inicia sesión en el panel
- **WHEN** un admin inicia sesión en `/admin` con credenciales válidas
- **THEN** accede al panel

#### Scenario: Usuario intenta usar el panel
- **WHEN** un usuario con rol `usuario` inicia sesión en `/admin` con credenciales válidas
- **THEN** el panel no muestra ninguna colección ni contenido y le indica que no tiene acceso

### Requirement: Contenido solo para usuarios autenticados
Todo usuario autenticado, con cualquier rol, SHALL poder leer todo el contenido del recetario, incluidos los archivos de medios. Sin sesión, el sistema MUST rechazar la lectura.

#### Scenario: Usuario consulta medios por la API
- **WHEN** un usuario con rol `usuario` lista los archivos de medios por la API
- **THEN** recibe todos los archivos, incluidos los de otros autores

#### Scenario: Visitante sin sesión consulta medios
- **WHEN** alguien sin sesión lista los archivos de medios o pide uno por su identificador
- **THEN** el sistema rechaza la operación por falta de permisos

### Requirement: Usuarios autenticados crean contenido
Todo usuario autenticado, con cualquier rol, SHALL poder crear contenido del recetario, incluidos los archivos de medios. Sin sesión, el sistema MUST rechazar la creación.

#### Scenario: Usuario sube un archivo
- **WHEN** un usuario con rol `usuario` sube un archivo de medios con texto alternativo
- **THEN** el archivo queda guardado

#### Scenario: Visitante sin sesión intenta subir un archivo
- **WHEN** alguien sin sesión intenta subir un archivo de medios
- **THEN** el sistema rechaza la operación por falta de permisos

### Requirement: El contenido registra a su autor
Al crear contenido, el sistema SHALL registrar como autor al usuario que lo crea. Solo un `admin` SHALL poder cambiar el autor de un contenido; un usuario con rol `usuario` MUST NOT poder cambiarlo ni indicarlo al crear.

#### Scenario: Autor asignado al crear
- **WHEN** un usuario con rol `usuario` sube un archivo de medios
- **THEN** el archivo queda con ese usuario como autor

#### Scenario: Usuario intenta asignar otro autor
- **WHEN** un usuario con rol `usuario` sube o modifica un archivo indicando a otra persona como autor
- **THEN** el autor queda siendo el propio usuario (al crear) o no cambia (al modificar)

#### Scenario: Usuario ve el nombre del autor de contenido ajeno
- **WHEN** un usuario con rol `usuario` consulta un archivo de medios creado por otra persona, pidiendo los datos relacionados
- **THEN** ve el nombre del autor, pero no su email ni su rol

#### Scenario: Admin reasigna el autor
- **WHEN** un admin cambia el autor de un archivo a otro usuario
- **THEN** el archivo queda con el nuevo autor

### Requirement: Cada usuario modifica solo su propio contenido
Un `admin` SHALL poder modificar y borrar cualquier contenido. Un usuario con rol `usuario` SHALL poder modificar y borrar solo el contenido del que es autor.

#### Scenario: Usuario edita su archivo
- **WHEN** un usuario con rol `usuario` modifica el texto alternativo de un archivo del que es autor
- **THEN** el cambio se guarda

#### Scenario: Usuario intenta editar o borrar un archivo ajeno
- **WHEN** un usuario con rol `usuario` intenta modificar o borrar un archivo cuyo autor es otra persona
- **THEN** el sistema rechaza la operación por falta de permisos

#### Scenario: Admin borra un archivo ajeno
- **WHEN** un admin borra un archivo cuyo autor es otro usuario
- **THEN** el archivo deja de existir

#### Scenario: Contenido sin autor
- **GIVEN** un archivo de medios sin autor registrado (anterior a este cambio, o cuyo autor fue borrado)
- **WHEN** un usuario con rol `usuario` intenta modificarlo o borrarlo
- **THEN** el sistema rechaza la operación; solo un admin puede hacerlo

### Requirement: Permisos uniformes en todas las vías de acceso
Las reglas por rol y por autor SHALL aplicarse igual en el panel de administración, la API REST y la API GraphQL.

#### Scenario: Usuario usa la API REST sobre contenido ajeno
- **WHEN** un usuario con rol `usuario` envía una petición REST para borrar un archivo cuyo autor es otra persona
- **THEN** el sistema rechaza la operación por falta de permisos

#### Scenario: Usuario usa la API GraphQL sobre contenido ajeno
- **WHEN** un usuario con rol `usuario` envía una mutación GraphQL para modificar un archivo cuyo autor es otra persona
- **THEN** el sistema rechaza la operación por falta de permisos
