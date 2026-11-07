const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const bcrypt = require('bcryptjs');
const { Op, Transaction } = require('sequelize');
const { sequelize, User, Room, Reservation } = require('./db');
const {
  HttpError,
  MAX_PER_DAY,
  isValidDate,
  parseId,
  validateLogin,
  validateReservation,
  hasStarted,
  localDate,
  createLoginLimiter,
} = require('./validation');

// 30 minutos de inactividad (configurable para pruebas).
const SESSION_TIMEOUT_MS = Number(process.env.SESSION_TIMEOUT_MS) || 30 * 60 * 1000;
const COOKIE_NAME = 'biblio.sid';

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Cola en memoria: serializa la verificación + inserción de reservas dentro
// del proceso. La transacción IMMEDIATE de SQLite cubre el caso de varios procesos.
let reservationQueue = Promise.resolve();
function withReservationLock(fn) {
  const run = reservationQueue.then(fn, fn);
  reservationQueue = run.catch(() => {});
  return run;
}

function createApp() {
  const app = express();
  app.use(express.json({ limit: '10kb' }));

  const loginLimiter = createLoginLimiter();

  const store = new SequelizeStore({
    db: sequelize,
    expiration: SESSION_TIMEOUT_MS,
    checkExpirationInterval: 5 * 60 * 1000, // limpieza de sesiones vencidas
  });

  app.use(
    session({
      name: COOKIE_NAME,
      secret: process.env.SESSION_SECRET || 'cambia-este-secreto-en-produccion',
      store,
      resave: false,
      saveUninitialized: false,
      rolling: true, // cada petición renueva la cookie: expira por INACTIVIDAD
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_TIMEOUT_MS,
      },
    })
  );

  // Verificación en el servidor: no confiamos solo en que el navegador
  // descarte la cookie vencida.
  function requireAuth(req, res, next) {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    const now = Date.now();
    if (req.session.lastActivity && now - req.session.lastActivity > SESSION_TIMEOUT_MS) {
      return req.session.destroy(() => {
        res.clearCookie(COOKIE_NAME);
        res.status(401).json({ error: 'Sesión expirada por inactividad' });
      });
    }
    req.session.lastActivity = now;
    next();
  }

  // ---------- Autenticación ----------
  app.post(
    '/api/auth/login',
    asyncHandler(async (req, res) => {
      const { username, password } = validateLogin(req.body);
      const ip = req.ip;

      if (loginLimiter.isBlocked(username, ip)) {
        throw new HttpError(429, 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.');
      }

      const user = await User.findOne({ where: { username } });
      const ok = user && (await bcrypt.compare(password, user.passwordHash));
      if (!ok) {
        loginLimiter.fail(username, ip);
        throw new HttpError(401, 'Usuario o contraseña incorrectos');
      }
      loginLimiter.succeed(username);

      // Nueva sesión tras el login (evita fijación de sesión).
      req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: 'No se pudo iniciar sesión' });
        req.session.userId = user.id;
        req.session.lastActivity = Date.now();
        res.json({ id: user.id, username: user.username, name: user.name });
      });
    })
  );

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.clearCookie(COOKIE_NAME);
      res.status(204).end();
    });
  });

  app.get(
    '/api/auth/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await User.findByPk(req.session.userId, { attributes: ['id', 'username', 'name'] });
      if (!user) throw new HttpError(401, 'No autenticado');
      res.json(user);
    })
  );

  // ---------- Salas ----------
  app.get(
    '/api/rooms',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json(await Room.findAll({ order: [['name', 'ASC']] }));
    })
  );

  // ---------- Reservas ----------
  // Reservas de una sala en una fecha (para ver la ocupación).
  app.get(
    '/api/rooms/:id/reservations',
    requireAuth,
    asyncHandler(async (req, res) => {
      const roomId = parseId(req.params.id, 'La sala');
      const { date } = req.query;
      if (!isValidDate(date)) throw new HttpError(400, 'Fecha inválida (formato AAAA-MM-DD)');
      const list = await Reservation.findAll({
        where: { roomId, date },
        include: [{ model: User, attributes: ['name'] }],
        order: [['startTime', 'ASC']],
      });
      res.json(list);
    })
  );

  app.get(
    '/api/reservations/mine',
    requireAuth,
    asyncHandler(async (req, res) => {
      const list = await Reservation.findAll({
        where: { userId: req.session.userId, date: { [Op.gte]: localDate(new Date()) } },
        include: [{ model: Room, attributes: ['id', 'name'] }],
        order: [
          ['date', 'ASC'],
          ['startTime', 'ASC'],
        ],
      });
      res.json(list);
    })
  );

  app.post(
    '/api/reservations',
    requireAuth,
    asyncHandler(async (req, res) => {
      // Solo se toman roomId, date, startTime y endTime; el userId sale de la sesión.
      const { roomId, date, startTime, endTime } = validateReservation(req.body);
      const userId = req.session.userId;

      const reservation = await withReservationLock(() =>
        sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE }, async (t) => {
          const room = await Room.findByPk(roomId, { transaction: t });
          if (!room) throw new HttpError(404, 'La sala no existe');

          // Dos intervalos [a,b) y [c,d) se solapan si a < d y c < b.
          // Así, 10:00-11:00 y 11:00-12:00 NO se solapan.
          const overlaps = { startTime: { [Op.lt]: endTime }, endTime: { [Op.gt]: startTime } };

          const conflict = await Reservation.findOne({
            where: { roomId, date, ...overlaps },
            transaction: t,
          });
          if (conflict) {
            throw new HttpError(
              409,
              `La sala ya está reservada de ${conflict.startTime} a ${conflict.endTime} ese día`
            );
          }

          const ownConflict = await Reservation.findOne({
            where: { userId, date, ...overlaps },
            include: [{ model: Room, attributes: ['name'] }],
            transaction: t,
          });
          if (ownConflict) {
            throw new HttpError(
              409,
              `Ya tienes una reserva de ${ownConflict.startTime} a ${ownConflict.endTime} en ${ownConflict.Room.name}`
            );
          }

          const countToday = await Reservation.count({ where: { userId, date }, transaction: t });
          if (countToday >= MAX_PER_DAY) {
            throw new HttpError(409, `Solo puedes tener ${MAX_PER_DAY} reservas por día`);
          }

          return Reservation.create({ roomId, userId, date, startTime, endTime }, { transaction: t });
        })
      );

      res.status(201).json(reservation);
    })
  );

  app.delete(
    '/api/reservations/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id, 'La reserva');
      const r = await Reservation.findByPk(id);
      if (!r) throw new HttpError(404, 'Reserva no encontrada');
      if (r.userId !== req.session.userId) throw new HttpError(403, 'Solo puedes cancelar tus reservas');
      if (hasStarted(r)) throw new HttpError(409, 'No se puede cancelar una reserva que ya comenzó o terminó');
      await r.destroy();
      res.status(204).end();
    })
  );

  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  // En producción, Express sirve el frontend compilado (mismo origen = cookies sin CORS).
  const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La petición es demasiado grande' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return { app, store };
}

module.exports = { createApp, SESSION_TIMEOUT_MS };