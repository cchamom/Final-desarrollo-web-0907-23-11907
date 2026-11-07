// Cliente HTTP único. Cualquier 401 dispara el manejador registrado
// por la app, que limpia el usuario y redirige al login.
let onUnauthorized = () => {};

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, skipAuthRedirect = false } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include', // envía la cookie de sesión
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  if (res.status !== 204) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (res.status === 401 && !skipAuthRedirect) {
    // Cuando la cookie vence el navegador ya no la envía y el servidor solo ve
    // "No autenticado"; para el usuario, en ambos casos es una sesión expirada.
    onUnauthorized('Tu sesión ha expirado por inactividad. Inicia sesión de nuevo.');
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `Error ${res.status}`);
  }
  return data;
}
