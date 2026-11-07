const { createApp, SESSION_TIMEOUT_MS } = require('./app');
const seed = require('./seed');

const PORT = Number(process.env.PORT) || 3001;

async function main() {
  const { app, store } = createApp();
  await seed(); // crea tablas y datos de ejemplo si la BD está vacía
  await store.sync(); // tabla de sesiones
  app.listen(PORT, () => {
    console.log(`API en http://localhost:${PORT} (sesión: ${SESSION_TIMEOUT_MS / 60000} min de inactividad)`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
