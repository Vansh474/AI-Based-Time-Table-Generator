const API_BASE = '/api';

// Keep auth token strictly in JS memory rather than localStorage/sessionStorage
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = 'API request failed';
    try {
      const error = await response.json();
      if (error?.message) errorMessage = error.message;
    } catch {
      // non-JSON error body
    }

    if (response.status === 401 && endpoint !== '/login' && endpoint !== '/auth/change-password') {
      authToken = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth-failure'));
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export const api = {
  getSetupStatus: () => apiRequest('/auth/setup-status'),
  setupAdmin: (payload: { email: string; password: string }) =>
    apiRequest('/auth/setup-admin', { method: 'POST', body: JSON.stringify(payload) }),
  login: (credentials: { email: string; password: string }) =>
    apiRequest('/login', { method: 'POST', body: JSON.stringify(credentials) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  getUsers: () => apiRequest('/users'),
  setUserPassword: (userId: string, password: string) =>
    apiRequest(`/users/${encodeURIComponent(userId)}/password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  getSchema: () => apiRequest('/schema'),
  saveSettings: (settings: any) => apiRequest('/save-settings', { method: 'POST', body: JSON.stringify(settings) }),
  generateTimetable: () => apiRequest('/generate', { method: 'POST' }),
  getTimetables: () => apiRequest('/timetables'),
  updateTimetable: (id: string, data: any) =>
    apiRequest(`/timetables/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTimetable: (id: string) =>
    apiRequest(`/timetables/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  chat: (message: string) => apiRequest('/chat', { method: 'POST', body: JSON.stringify({ message }) }),
  resolveConflicts: (entries: any) =>
    apiRequest('/resolve-conflicts', { method: 'POST', body: JSON.stringify({ entries }) }),
};
