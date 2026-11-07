import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, setUnauthorizedHandler } from './api.js';
import LoginPage from './pages/LoginPage.jsx';
import RoomsPage from './pages/RoomsPage.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  // Cualquier 401 de la API → limpiar usuario y redirigir al login.
  useEffect(() => {
    setUnauthorizedHandler((message) => {
      setUser(null);
      navigate('/login', { replace: true, state: { message } });
    });
  }, [navigate]);

  // ¿Hay una sesión activa al cargar la página?
  useEffect(() => {
    api('/auth/me', { skipAuthRedirect: true })
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  async function logout() {
    await api('/auth/logout', { method: 'POST', skipAuthRedirect: true }).catch(() => {});
    setUser(null);
    navigate('/login', { replace: true });
  }

  if (checking) return <p className="center">Cargando…</p>;

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage onLogin={setUser} />}
      />
      <Route
        path="/"
        element={user ? <RoomsPage user={user} onLogout={logout} /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
