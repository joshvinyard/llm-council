import { randomUUID } from 'crypto';
import db from './database.js';

// --- Users ---

export function createUser(email, passwordHash) {
  const id = randomUUID();
  const created_at = new Date().toISOString();
  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(id, email, passwordHash, created_at);
  return { id, email, created_at };
}

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) || null;
}

// --- Conversations ---

export function createConversation(conversationId, userId) {
  const created_at = new Date().toISOString();
  db.prepare('INSERT INTO conversations (id, user_id, title, created_at) VALUES (?, ?, ?, ?)').run(conversationId, userId, 'New Conversation', created_at);
  return { id: conversationId, created_at, title: 'New Conversation', messages: [] };
}

export function getConversation(conversationId, userId) {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(conversationId, userId);
  if (!conv) return null;

  const rows = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC').all(conversationId);
  const messages = rows.map((row) => {
    if (row.role === 'user') {
      return { role: 'user', content: row.content };
    }
    return {
      role: 'assistant',
      stage1: row.stage1 ? JSON.parse(row.stage1) : null,
      stage2: row.stage2 ? JSON.parse(row.stage2) : null,
      stage3: row.stage3 ? JSON.parse(row.stage3) : null,
    };
  });

  return { id: conv.id, created_at: conv.created_at, title: conv.title || 'New Conversation', messages };
}

export function listConversations(userId) {
  const rows = db.prepare(`
    SELECT c.id, c.title, c.created_at,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) AS message_count
    FROM conversations c
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `).all(userId);

  return rows.map((r) => ({
    id: r.id,
    title: r.title || 'New Conversation',
    created_at: r.created_at,
    message_count: r.message_count,
  }));
}

export function deleteConversation(conversationId, userId) {
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?').get(conversationId, userId);
  if (!conv) return false;
  db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId);
  db.prepare('DELETE FROM conversations WHERE id = ?').run(conversationId);
  return true;
}

// --- Messages ---

export function addUserMessage(conversationId, userId, content) {
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?').get(conversationId, userId);
  if (!conv) throw new Error(`Conversation ${conversationId} not found`);
  const created_at = new Date().toISOString();
  db.prepare('INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)').run(conversationId, 'user', content, created_at);
}

export function addAssistantMessage(conversationId, userId, stage1, stage2, stage3) {
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?').get(conversationId, userId);
  if (!conv) throw new Error(`Conversation ${conversationId} not found`);
  const created_at = new Date().toISOString();
  db.prepare('INSERT INTO messages (conversation_id, role, stage1, stage2, stage3, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    conversationId,
    'assistant',
    JSON.stringify(stage1),
    JSON.stringify(stage2),
    JSON.stringify(stage3),
    created_at
  );
}

export function updateConversationTitle(conversationId, userId, title) {
  const result = db.prepare('UPDATE conversations SET title = ? WHERE id = ? AND user_id = ?').run(title, conversationId, userId);
  if (result.changes === 0) throw new Error(`Conversation ${conversationId} not found`);
}

// --- Settings ---

export function getSettings(userId) {
  const row = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  if (!row) return null;
  return {
    councilModels: JSON.parse(row.council_models),
    chairmanModel: row.chairman_model,
  };
}

export function saveSettings(userId, settings) {
  const { councilModels, chairmanModel } = settings;
  const modelsJson = JSON.stringify(councilModels);
  db.prepare(`
    INSERT INTO settings (user_id, council_models, chairman_model)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET council_models = excluded.council_models, chairman_model = excluded.chairman_model
  `).run(userId, modelsJson, chairmanModel);
}

// --- Presets ---

export function getPresets(userId) {
  const rows = db.prepare('SELECT * FROM presets WHERE user_id = ?').all(userId);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    councilModels: JSON.parse(r.council_models),
    chairmanModel: r.chairman_model,
  }));
}

export function addPreset(userId, preset) {
  db.prepare('INSERT INTO presets (id, user_id, name, council_models, chairman_model) VALUES (?, ?, ?, ?, ?)').run(
    preset.id,
    userId,
    preset.name,
    JSON.stringify(preset.councilModels),
    preset.chairmanModel
  );
}

export function deletePreset(presetId, userId) {
  db.prepare('DELETE FROM presets WHERE id = ? AND user_id = ?').run(presetId, userId);
}
