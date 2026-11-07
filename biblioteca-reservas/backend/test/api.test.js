// Pruebas de integración de la API: node test/api.test.js
// Usa una BD temporal y un timeout de sesión corto para probar la expiración.
const os = require('os');
const path = require('path');
const fs = require('fs');
const assert = require('assert/strict');

const dbFile = path.join(os.tmpdir(), `biblio-test-${Date.now()}.sqlite`);
process.env.DB_PATH = dbFile;
process.env.SESSION_TIMEOUT_MS = '1500';

const { createApp } = require('../src/app');
const seed = require('../src/seed');
const { sequelize } = require('../src/db');

function client(base) {
  let cookie = '';
  return async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
}

const tomorrow = (() => {
  const d = new Date(Date.now() + 86400000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

(async () => {
  const { app, store } = createApp();
  await seed({ force: true });
  await store.sync();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;
  const ana = client(base);
  const luis = client(base);

  try {
    await test('sin sesión → 401', async () => {
      assert.equal((await ana('GET', '/api/rooms')).status, 401);
    });

    await test('login con contraseña incorrecta → 401', async () => {
      assert.equal((await ana('POST', '/api/auth/login', { username: 'ana', password: 'x' })).status, 401);
    });

    await test('login correcto y lista de salas', async () => {
      assert.equal((await ana('POST', '/api/auth/login', { username: 'ana', password: 'ana123' })).status, 200);
      assert.equal((await luis('POST', '/api/auth/login', { username: 'luis', password: 'luis123' })).status, 200);
      const rooms = await ana('GET', '/api/rooms');
      assert.equal(rooms.status, 200);
      assert.equal(rooms.body.length, 4);
    });

    await test('crear reserva 10:00-11:00 → 201', async () => {
      const r = await ana('POST', '/api/reservations', { roomId: 1, date: tomorrow, startTime: '10:00', endTime: '11:00' });
      assert.equal(r.status, 201);
    });

    await test('solapamientos → 409 (parcial, contenido y envolvente, otro usuario)', async () => {
      for (const [s, e] of [['10:30', '11:30'], ['09:30', '10:15'], ['10:15', '10:45'], ['09:00', '12:00'], ['10:00', '11:00']]) {
        const r = await luis('POST', '/api/reservations', { roomId: 1, date: tomorrow, startTime: s, endTime: e });
        assert.equal(r.status, 409, `${s}-${e} debía ser 409`);
      }
    });

    await test('horarios contiguos permitidos (09:00-10:00 y 11:00-12:00)', async () => {
      assert.equal((await luis('POST', '/api/reservations', { roomId: 1, date: tomorrow, startTime: '09:00', endTime: '10:00' })).status, 201);
      assert.equal((await luis('POST', '/api/reservations', { roomId: 1, date: tomorrow, startTime: '11:00', endTime: '12:00' })).status, 201);
    });

    await test('misma hora en otra sala → 201', async () => {
      assert.equal((await luis('POST', '/api/reservations', { roomId: 2, date: tomorrow, startTime: '10:00', endTime: '11:00' })).status, 201);
    });

    await test('validaciones → 400 (fin <= inicio, formato, fecha pasada)', async () => {
      assert.equal((await ana('POST', '/api/reservations', { roomId: 3, date: tomorrow, startTime: '12:00', endTime: '12:00' })).status, 400);
      assert.equal((await ana('POST', '/api/reservations', { roomId: 3, date: tomorrow, startTime: '9:00', endTime: '10:00' })).status, 400);
      assert.equal((await ana('POST', '/api/reservations', { roomId: 3, date: '2020-01-01', startTime: '09:00', endTime: '10:00' })).status, 400);
      assert.equal((await ana('POST', '/api/reservations', { roomId: 3, date: '2026-02-30', startTime: '09:00', endTime: '10:00' })).status, 400);
    });

    await test('10 peticiones simultáneas al mismo horario → solo 1 se crea', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          (i % 2 ? ana : luis)('POST', '/api/reservations', { roomId: 3, date: tomorrow, startTime: '15:00', endTime: '16:00' })
        )
      );
      const statuses = results.map((r) => r.status);
      assert.equal(statuses.filter((s) => s === 201).length, 1);
      assert.equal(statuses.filter((s) => s === 409).length, 9);
    });

    await test('actividad renueva la sesión; inactividad la expira → 401', async () => {
      // Peticiones cada 1 s (< 1.5 s de timeout): la sesión sigue viva.
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        assert.equal((await ana('GET', '/api/auth/me')).status, 200);
      }
      // 2 s sin actividad (> 1.5 s): expira.
      await new Promise((r) => setTimeout(r, 2000));
      const r = await ana('GET', '/api/rooms');
      assert.equal(r.status, 401);
    });

    console.log(`\n${passed} pruebas OK`);
  } catch (err) {
    console.error('\n✗ Falló:', err.message);
    process.exitCode = 1;
  } finally {
    server.close();
    await sequelize.close();
    fs.rmSync(dbFile, { force: true });
    process.exit();
  }
})();
