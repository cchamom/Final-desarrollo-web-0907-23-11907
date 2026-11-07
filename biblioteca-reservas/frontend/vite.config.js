import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El proxy hace que /api sea del mismo origen que el frontend,
// así la cookie de sesión viaja sin configurar CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
  },
});
