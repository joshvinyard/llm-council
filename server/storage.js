import fs from 'fs/promises';
import path from 'path';
import { DATA_DIR } from './config.js';

function ensureDataDir() {
  return fs.mkdir(DATA_DIR, { recursive: true });
}

function getConversationPath(conversationId) {
  return path.join(DATA_DIR, `${conversationId}.json`);
}

export async function createConversation(conversationId) {
  await ensureDataDir();

  const conversation = {
    id: conversationId,
    created_at: new Date().toISOString(),
    title: 'New Conversation',
    messages: [],
  };

  const filePath = getConversationPath(conversationId);
  await fs.writeFile(filePath, JSON.stringify(conversation, null, 2));

  return conversation;
}

export async function getConversation(conversationId) {
  const filePath = getConversationPath(conversationId);

  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function saveConversation(conversation) {
  await ensureDataDir();

  const filePath = getConversationPath(conversation.id);
  await fs.writeFile(filePath, JSON.stringify(conversation, null, 2));
}

export async function listConversations() {
  await ensureDataDir();

  let files;
  try {
    files = await fs.readdir(DATA_DIR);
  } catch {
    return [];
  }

  const conversations = [];

  for (const filename of files) {
    if (!filename.endsWith('.json')) continue;

    const filePath = path.join(DATA_DIR, filename);
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

    conversations.push({
      id: data.id,
      created_at: data.created_at,
      title: data.title || 'New Conversation',
      message_count: data.messages.length,
    });
  }

  // Sort by creation time, newest first
  conversations.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return conversations;
}

export async function addUserMessage(conversationId, content) {
  const conversation = await getConversation(conversationId);
  if (!conversation) throw new Error(`Conversation ${conversationId} not found`);

  conversation.messages.push({ role: 'user', content });
  await saveConversation(conversation);
}

export async function addAssistantMessage(conversationId, stage1, stage2, stage3) {
  const conversation = await getConversation(conversationId);
  if (!conversation) throw new Error(`Conversation ${conversationId} not found`);

  conversation.messages.push({ role: 'assistant', stage1, stage2, stage3 });
  await saveConversation(conversation);
}

const SETTINGS_PATH = path.join(path.dirname(DATA_DIR), 'settings.json');

export async function getSettings() {
  try {
    const data = await fs.readFile(SETTINGS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function saveSettings(settings) {
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export async function updateConversationTitle(conversationId, title) {
  const conversation = await getConversation(conversationId);
  if (!conversation) throw new Error(`Conversation ${conversationId} not found`);

  conversation.title = title;
  await saveConversation(conversation);
}
