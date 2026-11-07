// Copia de las reglas de backend/src/validation.js para avisar antes de enviar.
// El backend sigue siendo quien decide: si cambias una regla, cámbiala en ambos lados.
export const OPEN_TIME = '07:00';
export const CLOSE_TIME = '21:00';
export const MIN_MINUTES = 30;
export const MAX_MINUTES = 240;
export const SLOT_MINUTES = 15;
export const MAX_DAYS_AHEAD = 30;

const pad = (n) => String(n).padStart(2, '0');
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function maxDate() {
  const d = new Date();
  d.setDate(d.getDate() + MAX_DAYS_AHEAD);
  return localDate(d);
}

// Devuelve el primer error encontrado, o null si la reserva es válida.
export function reservationError({ date, startTime, endTime }, now = new Date()) {
  if (!date || !startTime || !endTime) return 'Completa la fecha y las horas.';
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);

  if (start % SLOT_MINUTES || end % SLOT_MINUTES) {
    return `Las horas deben ir en bloques de ${SLOT_MINUTES} minutos (:00, :15, :30, :45).`;
  }
  if (end <= start) return 'La hora de fin debe ser posterior a la de inicio.';
  if (start < toMinutes(OPEN_TIME) || end > toMinutes(CLOSE_TIME)) {
    return `El horario de la biblioteca es de ${OPEN_TIME} a ${CLOSE_TIME}.`;
  }
  if (end - start < MIN_MINUTES) return `La reserva debe durar al menos ${MIN_MINUTES} minutos.`;
  if (end - start > MAX_MINUTES) return `La reserva no puede durar más de ${MAX_MINUTES / 60} horas.`;

  const today = localDate(now);
  if (date < today) return 'No se puede reservar en una fecha pasada.';
  if (date === today && start <= now.getHours() * 60 + now.getMinutes()) return 'La hora de inicio ya pasó.';
  if (date > maxDate()) return `Solo se puede reservar con hasta ${MAX_DAYS_AHEAD} días de anticipación.`;
  return null;
}

export function hasStarted({ date, startTime }, now = new Date()) {
  const today = localDate(now);
  if (date !== today) return date < today;
  return toMinutes(startTime) <= now.getHours() * 60 + now.getMinutes();
}