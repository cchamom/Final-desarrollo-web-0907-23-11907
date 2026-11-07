import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function LoginPage({ onLogin }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const notice = location.state?.message;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // skipAuthRedirect: un 401 aquí es "credenciales incorrectas", no sesión vencida.
      const user = await api('/auth/login', {
        method: 'POST',
        body: { username, password },
        skipAuthRedirect: true,
      });
      onLogin(user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login">
      <form className="card" onSubmit={handleSubmit}>
        <h1>Biblioteca</h1>
        <p className="muted">Reserva de salas de estudio</p>

        {notice && !error && <p className="alert info">{notice}</p>}
        {error && <p className="alert error">{error}</p>}

        <label>
          Usuario
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Iniciar sesión'}</button>
        <p className="muted small">Demo: ana / ana123 · luis / luis123</p>
      </form>
    </main>
  );
}
