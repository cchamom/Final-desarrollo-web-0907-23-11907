# Reservas de salas · Biblioteca

Node.js + Express + Sequelize (SQLite) en el backend, React (Vite) en el frontend, sesión con cookies.
El archivo de Sqlite se encuentra en la carpeta test

## Requisitos
- Node.js 18 o superior

## Puesta en marcha (desarrollo)

```bash
# Terminal 1 – API en http://localhost:3001
cd backend
npm install
npm run dev        # crea biblioteca.sqlite con datos de ejemplo la primera vez

# Terminal 2 – React en http://localhost:5173
cd frontend
npm install
npm run dev
```

Abre http://localhost:5173. Usuarios de prueba: **ana / ana123** y **luis / luis123**.

Vite redirige `/api` al backend (proxy), así el frontend y la API comparten origen y la cookie viaja sin configurar CORS.

## Producción (un solo servidor)

```bash
cd frontend && npm run build
cd ../backend && NODE_ENV=production SESSION_SECRET="un-secreto-largo" npm start
```

Express sirve `frontend/dist` y la API en el mismo puerto (3001). Con `NODE_ENV=production` la cookie se marca `secure` (requiere HTTPS).

## Pruebas

```bash
cd backend && npm test
```

Cubre: 401 sin sesión, login, solapamientos (parcial, contenido, envolvente), horarios contiguos permitidos, validaciones, 10 peticiones simultáneas al mismo horario (solo 1 se crea) y expiración por inactividad.

## Cómo se cumple cada requisito

| Requisito | Dónde |
|---|---|
| Login con sesión de cookies | `express-session` + `connect-session-sequelize` (sesiones guardadas en SQLite). Cookie `httpOnly`, `sameSite=lax`. La sesión se regenera al hacer login. |
| Expira a los 30 min de inactividad | `rolling: true` + `maxAge` de 30 min: cada petición renueva la cookie. Además `requireAuth` guarda `lastActivity` y rechaza en el servidor si pasaron más de 30 min (no depende de que el navegador descarte la cookie). |
| Sin reservas solapadas | `POST /api/reservations`: dos intervalos se solapan si `inicioA < finB` y `inicioB < finA`. 10:00–11:00 y 11:00–12:00 son válidos. La verificación e inserción ocurren en una transacción `IMMEDIATE` y en cola dentro del proceso, para que dos peticiones simultáneas no pasen ambas la validación. Responde **409** si hay conflicto. |
| Redirigir al login en 401 | `frontend/src/api.js`: todas las peticiones pasan por `api()`; un 401 llama al manejador que registra `App.jsx`, que borra el usuario y navega a `/login` con el aviso de sesión expirada. |

## API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | `{ username, password }` |
| POST | `/api/auth/logout` | Cierra la sesión |
| GET | `/api/auth/me` | Usuario actual |
| GET | `/api/rooms` | Lista de salas |
| GET | `/api/rooms/:id/reservations?date=AAAA-MM-DD` | Ocupación de una sala en un día |
| GET | `/api/reservations/mine` | Mis próximas reservas |
| POST | `/api/reservations` | `{ roomId, date, startTime, endTime }` (horas `HH:MM`) |
| DELETE | `/api/reservations/:id` | Cancelar una reserva propia |

## Variables de entorno (backend)
- `PORT` (3001), `DB_PATH` (`backend/biblioteca.sqlite`), `SESSION_SECRET`, `SESSION_TIMEOUT_MS` (1800000 = 30 min; útil para probar con valores cortos).

## Estructura
```
backend/
  src/db.js       modelos Sequelize (User, Room, Reservation)
  src/app.js      Express: sesión, rutas, validación de solapamiento
  src/server.js   arranque
  src/seed.js     datos de ejemplo (npm run seed -- --force para reiniciar)
  test/api.test.js
frontend/
  src/api.js      cliente fetch + manejo de 401
  src/App.jsx     rutas y estado de sesión
  src/pages/LoginPage.jsx
  src/pages/RoomsPage.jsx
```
