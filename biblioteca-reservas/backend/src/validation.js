// Reglas de validación como funciones puras: reciben los datos (y la hora
// actual cuando importa) y devuelven el valor normalizado o lanzan HttpError.
// Así se pueden probar sin servidor ni base de datos.

const OPEN_TIME = '07:00'; // apertura de la biblioteca
const CLOSE_TIME = '21:00'; // cierre: la reserva debe terminar a esta hora o antes
const MIN_MINUTES = 30; // duración mínima de una reserva
const MAX_MINUTES = 240; // duración máxima (4 horas)
const SLOT_MINUTES = 15; // las horas van en bloques de 15 minutos
const MAX_DAYS_AHEAD = 30; // anticipación máxima
const MAX_PER_DAY = 2; // reservas por usuario y día

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 100;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[1-9]\d*$/;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const bad = (message) => new HttpError(400, message);
const pad = (n) => String(n).padStart(2, '0');

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function localDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localTime(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isValidDate(str) {
  if (typeof str !== 'string' || !DATE_RE.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

// Acepta 3 o "3"; rechaza "abc", 1.5, -1, 0, null, true, etc.
function parseId(value, label = 'El identificador') {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && ID_RE.test(value) && Number(value) <= Number.MAX_SAFE_INTEGER) {
    return Number(value);
  }
  throw bad(`${label} debe ser un número entero positivo`);
}

function validateLogin(body) {
  const { username, password } = body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw bad('Usuario y contraseña son obligatorios');
  }
  const user = username.trim();
  if (user.length < USERNAME_MIN || user.length > USERNAME_MAX) {
    throw bad(`El usuario debe tener entre ${USERNAME_MIN} y ${USERNAME_MAX} caracteres`);
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw bad(`La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres`);
  }
  return { username: user, password };
}

// Devuelve solo los campos permitidos: cualquier otro (p. ej. userId) se ignora.
function validateReservation(body, now = new Date()) {
  const { roomId, date, startTime, endTime } = body || {};

  if (roomId == null || date == null || startTime == null || endTime == null) {
    throw bad('Sala, fecha, hora de inicio y hora de fin son obligatorias');
  }
  const room = parseId(roomId, 'La sala');

  if (!isValidDate(date)) throw bad('Fecha inválida (formato AAAA-MM-DD)');
  if (typeof startTime !== 'string' || typeof endTime !== 'string' ||
      !TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    throw bad('Hora inválida (formato HH:MM)');
  }

  const start = toMinutes(startTime);
  const end = toMinutes(endTime);

  if (start % SLOT_MINUTES !== 0 || end % SLOT_MINUTES !== 0) {
    throw bad(`Las horas deben ir en bloques de ${SLOT_MINUTES} minutos (:00, :15, :30, :45)`);
  }
  if (end <= start) throw bad('La hora de fin debe ser posterior a la de inicio');
  if (start < toMinutes(OPEN_TIME) || end > toMinutes(CLOSE_TIME)) {
    throw bad(`El horario de la biblioteca es de ${OPEN_TIME} a ${CLOSE_TIME}`);
  }
  const duration = end - start;
  if (duration < MIN_MINUTES) throw bad(`La reserva debe durar al menos ${MIN_MINUTES} minutos`);
  if (duration > MAX_MINUTES) throw bad(`La reserva no puede durar más de ${MAX_MINUTES / 60} horas`);

  const today = localDate(now);
  if (date < today) throw bad('No se puede reservar en una fecha pasada');
  if (date === today && start <= toMinutes(localTime(now))) {
    throw bad('La hora de inicio ya pasó');
  }
  if (date > addDays(today, MAX_DAYS_AHEAD)) {
    throw bad(`Solo se puede reservar con hasta ${MAX_DAYS_AHEAD} días de anticipación`);
  }

  return { roomId: room, date, startTime, endTime };
}

// Una reserva ya comenzada (o pasada) no se puede cancelar.
function hasStarted(reservation, now = new Date()) {
  const today = localDate(now);
  if (reservation.date !== today) return reservation.date < today;
  return toMinutes(reservation.startTime) <= toMinutes(localTime(now));
}

// Limitador de intentos fallidos en memoria (ventana deslizante).
function createLoginLimiter({ maxPerUser = 5, maxPerIp = 20, windowMs = 15 * 60 * 1000 } = {}) {
  const failures = new Map(); // clave -> [timestamps]

  const recent = (key, now) => {
    const list = (failures.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length) failures.set(key, list);
    else failures.delete(key);
    return list;
  };

  return {
    isBlocked(username, ip, now = Date.now()) {
      return recent(`u:${username.toLowerCase()}`, now).length >= maxPerUser ||
        recent(`ip:${ip}`, now).length >= maxPerIp;
    },
    fail(username, ip, now = Date.now()) {
      for (const key of [`u:${username.toLowerCase()}`, `ip:${ip}`]) {
        failures.set(key, [...recent(key, now), now]);
      }
    },
    succeed(username) {
      failures.delete(`u:${username.toLowerCase()}`);
    },
  };
}

module.exports = {
  HttpError,
  OPEN_TIME,
  CLOSE_TIME,
  MIN_MINUTES,
  MAX_MINUTES,
  SLOT_MINUTES,
  MAX_DAYS_AHEAD,
  MAX_PER_DAY,
  isValidDate,
  parseId,
  validateLogin,
  validateReservation,
  hasStarted,
  localDate,
  createLoginLimiter,
};