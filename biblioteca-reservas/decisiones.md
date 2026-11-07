# Decisiones del proyecto: Reservas de salas de biblioteca

## A) Qué se entendió del problema y qué modelo de datos se planteó

El problema principal es que se debe de manejar la disponibilidad y los horarios de una sala para un mismo evento. Evitar que una sala tenga el mismo horario y fecha es crucial para evitar problemas con losclientes, ademas que otras salas si pueden tener los mismo horarios y fecha.




### Modelo (Sequelize + SQLite)

| Tabla | Campos | Notas |
|---|---|---|
| **Users** | `id`, `username` (único), `name`, `passwordHash` | Contraseña guardada con bcrypt, nunca en texto plano. |
| **Rooms** | `id`, `name` (único), `capacity`, `description` | Datos de ejemplo cargados por `seed.js`. |
| **Reservations** | `id`, `roomId` → Rooms, `userId` → Users, `date` (DATEONLY), `startTime`, `endTime` | Índice en `(roomId, date)` porque la consulta de solapamiento siempre filtra por esos dos campos. |
| **Sessions** | `sid`, `expires`, `data` | Creada por `connect-session-sequelize`; las sesiones quedan en la misma BD. |

La relacion que plantee fue ue una sala tiene muchas reservas, y un usuario tiene muchas reservas. 

## B) Qué partes se delegaron a la IA 

Lo que le define a la IA en el prompt principal fue el stack obligatorio y las cosas que yo necesitaba extrar agregar (Node.js, Sequelize, SQLite, React básico, cookies) y los requisitos funcionales que pide ñla web, como login, lista de salas, formulario de reserva, regla de no solapamiento, expiración a los 30 minutos de inactividad y redirección en 401.

**Lo que se delegó a la IA (Claude):** prácticamente toda la implementación.

- Diseño del modelo de datos y de la API REST.
- Código del backend: modelos, sesión, autenticación, validaciones y regla de solapamiento.
- Código del frontend: cliente api() con manejo de 401, rutas, páginas de login y de reservas, y estilos.


## Por qué se delegó ala IA:

Por que es una aplicación que funciona con un CRUD basico con requisitos claros y cerrados. La IA puede generar la estructura completa rápido y de forma consistente.

La IA podía, además de escribir código, ejecutarlo y probarlo. Instaló dependencias, corrió las pruebas y abrió la app en un navegador real. Así se pudo verificar que los requisitos se cumplen de verdad, y no solo leer el código y suponerlo.


## C) Algo que la IA hizo mal o tuvo que corregir

### El mensaje al expirar la sesión era incorrecto

- La primera versión del cliente api() mostraba en el login el mensaje de error que mandaba el servidor. Se esperaba que, al vencer la sesión, el usuario viera "Sesión expirada por inactividad". En la práctica veía: No autenticado.

- Hubo una mala instalacion de los paquetes ue baje con npm, el proyecto no me detectaba los que la IA me dijiera que instalara asi que le pedi que me los corrigiera.

- Error de un archivo que estaba en una carpeta que no correspondia, ocurrió al copiar los archivos de la mejora de validaciones. RoomsPage.jsx importa las reglas de validación desde frontend/src/rules.js, pero ese archivo no estaba en esa ruta.
