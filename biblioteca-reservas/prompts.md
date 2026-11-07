# Prompts usados con la IA (Claude)

Registro de las instrucciones dadas a la IA durante el desarrollo, en orden, con un resumen de lo que produjo cada una.

# Prompts reales

## 1) Contexto y stack
 
Ayudame a construir una aplicacion para reservas de salas de una bibliocteca. Stack obligatorio: Node.js + Sequelize, BD en sqlite, React basico y sesion con cookies.
 
## 2) Requisitos
 
Requisitos: Login de usuario con sesion de cookies, lista de salas y formularios para crear una reserva(sala, fecha, hora inicio, hora fin). Una sola no puede tener dos reservas con horarios solapados. La sesion debe de expirar a los 30 minutos de inactividad y el frontend debe de redirigir al login al recibir un 401

**El resultado que me dio:** proyecto completo con dos partes.

- `backend/`: Express, Sequelize, SQLite, `express-session` y sesiones guardadas en la BD.
- `frontend/`: React con Vite.


### 3. Error al arrancar el backend

 npm run dev … Error: Cannot find module 'express' …

- la IA explicó que faltaba ejecutar `npm install`, porque el zip no incluye `node_modules`. También dio los pasos para backend y frontend.

### 4. Falla al compilar sqlite3
 
Al hacer `npm install` en el backend me sale `gyp ERR! find VS` y `npm ERR! sqlite3@5.1.7 install: prebuild-install || node-gyp rebuild`. Estoy en Windows con Node 24. ¿Cómo lo soluciono?
 
### 5. Conflicto de dependencias en el frontend
 
Al hacer `npm install` en el frontend me sale `npm ERR! code ERESOLVE` y `unable to resolve dependency tree` entre `vite` y `@vitejs/plugin-react`. ¿Qué hago?


## 6. Mejora en las validaciones del front

Quiero reforzar las validaciones del BACKEND, sin depender de las del frontend. Mantén el formato actual de errores: `{ error: "mensaje en español" }` con status 400 para datos inválidos, 401, 403, 404 y 409 según corresponda.

Validaciones a agregar:

1. Login (`POST /api/auth/login`)
   - `username` y `password` deben ser strings; recortar espacios en `username`.
   - Longitud: usuario de 3 a 30 caracteres, contraseña de 6 a 100.
   - Limitar intentos fallidos: tras 5 intentos fallidos del mismo usuario o IP en 15 minutos, responder 429 con un mensaje claro.


2. Crear reserva (`POST /api/reservations`)
    - Horario de la biblioteca: inicio desde las 07:00 y fin como máximo a las 21:00.
   - Duración mínima de 30 minutos y máxima de 4 horas.
   - Horas solo en bloques de 15 minutos (:00, :15, :30, :45).
   - Si la fecha es hoy, la hora de inicio no puede haber pasado.

## 7. Error de Vite: no encuentra rules.js

Ayuda a resolver este errore que me da del lado del front:
[plugin:vite:import-analysis] Failed to resolve import "../rules.js" from "src/pages/RoomsPage.jsx". Does the file exist? C:/Users/Christian Chamo/Desktop/ExamenFinalDesarrolloWeb/biblioteca-reservas/frontend/src/pages/RoomsPage.jsx:11:7

26 |    maxDate,
27 |    reservationError
28 |  } from "../rules.js";
   |          ^


 