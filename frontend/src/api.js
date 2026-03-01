/**
 * API client for the LLM Bullpen backend.
 */

const API_BASE = '';
const TOKEN_KEY = 'council_token';

function getAuthHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function authFetch(url, options = {}) {
  const headers = { ...getAuthHeaders(), ...options.headers };
  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
    throw new Error('Session expired');
  }

  return response;
}

export const api = {
  // --- Auth ---

  async login(email, password) {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Login failed');
    }
    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    return data;
  },

  async register(email, password) {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Registration failed');
    }
    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    return data;
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
  },

  isAuthenticated() {
    return !!localStorage.getItem(TOKEN_KEY);
  },

  getStoredUser() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return { id: payload.userId, email: payload.email };
    } catch {
      return null;
    }
  },

  // --- Conversations ---

  async listConversations() {
    const response = await authFetch(`${API_BASE}/api/conversations`);
    if (!response.ok) throw new Error('Failed to list conversations');
    return response.json();
  },

  async createConversation() {
    const response = await authFetch(`${API_BASE}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!response.ok) throw new Error('Failed to create conversation');
    return response.json();
  },

  async getConversation(conversationId) {
    const response = await authFetch(`${API_BASE}/api/conversations/${conversationId}`);
    if (!response.ok) throw new Error('Failed to get conversation');
    return response.json();
  },

  // --- Settings ---

  async getSettings() {
    const response = await authFetch(`${API_BASE}/api/settings`);
    if (!response.ok) throw new Error('Failed to get settings');
    return response.json();
  },

  async saveSettings(settings) {
    const response = await authFetch(`${API_BASE}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) throw new Error('Failed to save settings');
    return response.json();
  },

  // --- Models ---

  async getAvailableModels() {
    const response = await authFetch(`${API_BASE}/api/models`);
    if (!response.ok) throw new Error('Failed to get models');
    return response.json();
  },

  async getModelsHealth(modelIds) {
    const response = await authFetch(
      `${API_BASE}/api/models/health?ids=${encodeURIComponent(modelIds.join(','))}`
    );
    if (!response.ok) throw new Error('Failed to get model health');
    return response.json();
  },

  // --- Presets ---

  async getPresets() {
    const response = await authFetch(`${API_BASE}/api/presets`);
    if (!response.ok) throw new Error('Failed to get presets');
    return response.json();
  },

  async createPreset({ name, councilModels, chairmanModel }) {
    const response = await authFetch(`${API_BASE}/api/presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, councilModels, chairmanModel }),
    });
    if (!response.ok) throw new Error('Failed to create preset');
    return response.json();
  },

  async deletePreset(id) {
    const response = await authFetch(`${API_BASE}/api/presets/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete preset');
    return response.json();
  },

  // --- Messages ---

  async sendMessage(conversationId, content) {
    const response = await authFetch(
      `${API_BASE}/api/conversations/${conversationId}/message`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }
    );
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  },

  async sendMessageStream(conversationId, content, onEvent, modelOverride) {
    const body = { content };
    if (modelOverride) {
      body.councilModels = modelOverride.councilModels;
      body.chairmanModel = modelOverride.chairmanModel;
    }

    const response = await authFetch(
      `${API_BASE}/api/conversations/${conversationId}/message/stream`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) throw new Error('Failed to send message');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);
            onEvent(event.type, event);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    }
  },
};
