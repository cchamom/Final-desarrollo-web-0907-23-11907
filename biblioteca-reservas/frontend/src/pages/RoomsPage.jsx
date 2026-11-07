import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import {
  CLOSE_TIME,
  OPEN_TIME,
  SLOT_MINUTES,
  hasStarted,
  localDate,
  maxDate,
  reservationError,
} from '../rules.js';

const today = () => localDate();
// Por defecto mañana: con "hoy" a las 09:00 la hora de inicio podría haber pasado.
const tomorrow = () => localDate(new Date(Date.now() + 86400000));

export default function RoomsPage({ user, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState({ roomId: '', date: tomorrow(), startTime: '09:00', endTime: '10:00' });
  const [dayReservations, setDayReservations] = useState([]);
  const [mine, setMine] = useState([]);
  const [message, setMessage] = useState(null); // { type: 'error' | 'success', text }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/rooms')
      .then((list) => {
        setRooms(list);
        if (list.length) setForm((f) => ({ ...f, roomId: f.roomId || String(list[0].id) }));
      })
      .catch(() => {}); // un 401 ya redirige al login
  }, []);

  const loadMine = useCallback(() => {
    api('/reservations/mine').then(setMine).catch(() => {});
  }, []);

  const loadDay = useCallback(() => {
    if (!form.roomId || !form.date) return;
    api(`/rooms/${form.roomId}/reservations?date=${form.date}`).then(setDayReservations).catch(() => {});
  }, [form.roomId, form.date]);

  useEffect(loadMine, [loadMine]);
  useEffect(loadDay, [loadDay]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);
    const error = reservationError(form);
    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }
    setSaving(true);
    try {
      await api('/reservations', { method: 'POST', body: { ...form, roomId: Number(form.roomId) } });
      setMessage({ type: 'success', text: 'Reserva creada.' });
      loadDay();
      loadMine();
    } catch (err) {
      if (err.status !== 401) setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function cancel(id) {
    if (!confirm('¿Cancelar esta reserva?')) return;
    try {
      await api(`/reservations/${id}`, { method: 'DELETE' });
      loadMine();
      loadDay();
    } catch (err) {
      if (err.status !== 401) setMessage({ type: 'error', text: err.message });
    }
  }

  const selectedRoom = rooms.find((r) => String(r.id) === form.roomId);

  return (
    <div className="layout">
      <header className="topbar">
        <strong>Biblioteca · Reservas</strong>
        <span>
          {user.name} <button className="link" onClick={onLogout}>Cerrar sesión</button>
        </span>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Salas</h2>
          <ul className="rooms">
            {rooms.map((room) => (
              <li
                key={room.id}
                className={String(room.id) === form.roomId ? 'selected' : ''}
                onClick={() => setForm((f) => ({ ...f, roomId: String(room.id) }))}
              >
                <div className="room-name">{room.name}</div>
                <div className="muted small">
                  Capacidad: {room.capacity} · {room.description}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Nueva reserva</h2>
          {message && <p className={`alert ${message.type}`}>{message.text}</p>}
          <form onSubmit={handleSubmit} className="form">
            <label>
              Sala
              <select value={form.roomId} onChange={update('roomId')} required>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            <label>
              Fecha
              <input type="date" value={form.date} min={today()} max={maxDate()} onChange={update('date')} required />
            </label>
            <div className="row">
              <label>
                Hora inicio
                <input type="time" value={form.startTime} min={OPEN_TIME} max={CLOSE_TIME}
                  step={SLOT_MINUTES * 60} onChange={update('startTime')} required />
              </label>
              <label>
                Hora fin
                <input type="time" value={form.endTime} min={OPEN_TIME} max={CLOSE_TIME}
                  step={SLOT_MINUTES * 60} onChange={update('endTime')} required />
              </label>
            </div>
            <p className="muted small">
              Horario {OPEN_TIME}–{CLOSE_TIME}, bloques de {SLOT_MINUTES} min, de 30 min a 4 h. Máximo 2 reservas por día.
            </p>
            <button type="submit" disabled={saving || !form.roomId}>{saving ? 'Guardando…' : 'Reservar'}</button>
          </form>

          <h3>Ocupación de {selectedRoom?.name ?? 'la sala'} el {form.date}</h3>
          {dayReservations.length === 0 ? (
            <p className="muted">Sin reservas ese día.</p>
          ) : (
            <ul className="slots">
              {dayReservations.map((r) => (
                <li key={r.id}>
                  {r.startTime} – {r.endTime} <span className="muted">({r.User?.name})</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Mis próximas reservas</h2>
          {mine.length === 0 ? (
            <p className="muted">No tienes reservas.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Sala</th><th>Fecha</th><th>Horario</th><th></th></tr>
              </thead>
              <tbody>
                {mine.map((r) => (
                  <tr key={r.id}>
                    <td>{r.Room?.name}</td>
                    <td>{r.date}</td>
                    <td>{r.startTime} – {r.endTime}</td>
                    <td>
                      {hasStarted(r) ? (
                        <span className="muted small">En curso</span>
                      ) : (
                        <button className="link danger" onClick={() => cancel(r.id)}>Cancelar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}