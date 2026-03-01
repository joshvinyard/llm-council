import express from 'express';
import { randomUUID } from 'crypto';
import * as storage from './storage.js';
import { OPENROUTER_API_KEY, getActiveSettings } from './config.js';
import { hashPassword, verifyPassword, generateToken, authMiddleware } from './auth.js';
import {
  stage1CollectResponses,
  stage2CollectRankings,
  stage3SynthesizeFinal,
  calculateAggregateRankings,
  generateConversationTitle,
  runFullCouncil,
} from './council.js';

const app = express();
app.use(express.json());

// --- Auth Routes (public) ---

app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ detail: 'A valid email is required' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ detail: 'Password must be at least 6 characters' });
  }

  const existing = storage.getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ detail: 'An account with this email already exists' });
  }

  const passwordHash = hashPassword(password);
  const user = storage.createUser(email, passwordHash);
  const token = generateToken(user);

  res.json({ token, user: { id: user.id, email: user.email } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ detail: 'Email and password are required' });
  }

  const user = storage.getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ detail: 'Invalid email or password' });
  }

  const token = generateToken(user);
  res.json({ token, user: { id: user.id, email: user.email } });
});

// --- Apply auth middleware to all other API routes ---

app.use('/api', authMiddleware);

// --- Settings & Models API Routes ---

app.get('/api/settings', (req, res) => {
  const settings = getActiveSettings(req.userId);
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  const { councilModels, chairmanModel } = req.body;
  if (!Array.isArray(councilModels) || councilModels.length < 2) {
    return res.status(400).json({ detail: 'At least 2 council models required' });
  }
  if (typeof chairmanModel !== 'string' || !chairmanModel) {
    return res.status(400).json({ detail: 'A chairman model is required' });
  }
  storage.saveSettings(req.userId, { councilModels, chairmanModel });
  res.json({ councilModels, chairmanModel });
});

// --- Preset API Routes ---

app.get('/api/presets', (req, res) => {
  const presets = storage.getPresets(req.userId);
  res.json(presets);
});

app.post('/api/presets', (req, res) => {
  const { name, councilModels, chairmanModel } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ detail: 'A preset name is required' });
  }
  if (!Array.isArray(councilModels) || councilModels.length < 2) {
    return res.status(400).json({ detail: 'At least 2 council models required' });
  }
  if (typeof chairmanModel !== 'string' || !chairmanModel) {
    return res.status(400).json({ detail: 'A chairman model is required' });
  }
  const preset = { id: randomUUID(), name, councilModels, chairmanModel };
  storage.addPreset(req.userId, preset);
  res.json(preset);
});

app.delete('/api/presets/:id', (req, res) => {
  storage.deletePreset(req.params.id, req.userId);
  res.json({ ok: true });
});

app.get('/api/models', async (req, res) => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` },
    });
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ detail: text });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// --- Model Health API ---

const healthCache = new Map(); // modelId -> { data, fetchedAt }
const HEALTH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchModelHealth(modelId) {
  const cached = healthCache.get(modelId);
  if (cached && Date.now() - cached.fetchedAt < HEALTH_CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(
      `https://openrouter.ai/api/v1/models/${modelId}/endpoints`,
      { headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` } }
    );
    if (!response.ok) {
      const result = { status: 'unknown', uptime: null };
      healthCache.set(modelId, { data: result, fetchedAt: Date.now() });
      return result;
    }

    const json = await response.json();
    const endpoints = json.data?.endpoints || json.endpoints || [];

    if (endpoints.length === 0) {
      const result = { status: 'unknown', uptime: null };
      healthCache.set(modelId, { data: result, fetchedAt: Date.now() });
      return result;
    }

    // Use the best endpoint's uptime to determine overall model status
    const uptimes = endpoints
      .map((ep) => ep.uptime_last_30m)
      .filter((u) => u !== null && u !== undefined);

    const bestUptime = uptimes.length > 0 ? Math.max(...uptimes) : null;

    let status;
    if (bestUptime === null) {
      status = 'unknown';
    } else if (bestUptime >= 99) {
      status = 'up';
    } else if (bestUptime >= 90) {
      status = 'degraded';
    } else {
      status = 'down';
    }

    const result = { status, uptime: bestUptime };
    healthCache.set(modelId, { data: result, fetchedAt: Date.now() });
    return result;
  } catch {
    const result = { status: 'unknown', uptime: null };
    healthCache.set(modelId, { data: result, fetchedAt: Date.now() });
    return result;
  }
}

app.get('/api/models/health', async (req, res) => {
  const ids = req.query.ids;
  if (!ids || typeof ids !== 'string') {
    return res.status(400).json({ detail: 'ids query parameter required (comma-separated model IDs)' });
  }

  const modelIds = ids.split(',').map((s) => s.trim()).filter(Boolean);
  if (modelIds.length === 0) {
    return res.json({});
  }

  // Fetch in parallel with concurrency limit of 20
  const CONCURRENCY = 20;
  const results = {};

  for (let i = 0; i < modelIds.length; i += CONCURRENCY) {
    const batch = modelIds.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (id) => ({ id, health: await fetchModelHealth(id) }))
    );
    for (const { id, health } of batchResults) {
      results[id] = health;
    }
  }

  res.json(results);
});

// --- Conversation API Routes ---

app.get('/api/conversations', (req, res) => {
  const conversations = storage.listConversations(req.userId);
  res.json(conversations);
});

app.post('/api/conversations', (req, res) => {
  const id = randomUUID();
  const conversation = storage.createConversation(id, req.userId);
  res.json(conversation);
});

app.get('/api/conversations/:id', (req, res) => {
  const conversation = storage.getConversation(req.params.id, req.userId);
  if (!conversation) return res.status(404).json({ detail: 'Conversation not found' });
  res.json(conversation);
});

app.delete('/api/conversations/:id', (req, res) => {
  const deleted = storage.deleteConversation(req.params.id, req.userId);
  if (!deleted) return res.status(404).json({ detail: 'Conversation not found' });
  res.json({ ok: true });
});

app.post('/api/conversations/:id/message', async (req, res) => {
  const { id } = req.params;
  const { content, councilModels: overrideCouncil, chairmanModel: overrideChairman } = req.body;

  const conversation = storage.getConversation(id, req.userId);
  if (!conversation) return res.status(404).json({ detail: 'Conversation not found' });

  const isFirstMessage = conversation.messages.length === 0;

  storage.addUserMessage(id, req.userId, content);

  if (isFirstMessage) {
    const title = await generateConversationTitle(content);
    storage.updateConversationTitle(id, req.userId, title);
  }

  const defaults = getActiveSettings(req.userId);
  const councilModels = (Array.isArray(overrideCouncil) && overrideCouncil.length >= 2) ? overrideCouncil : defaults.councilModels;
  const chairmanModel = (typeof overrideChairman === 'string' && overrideChairman) ? overrideChairman : defaults.chairmanModel;
  const [stage1Results, stage2Results, stage3Result, metadata] = await runFullCouncil(content, councilModels, chairmanModel);

  storage.addAssistantMessage(id, req.userId, stage1Results, stage2Results, stage3Result);

  res.json({ stage1: stage1Results, stage2: stage2Results, stage3: stage3Result, metadata });
});

app.post('/api/conversations/:id/message/stream', async (req, res) => {
  const { id } = req.params;
  const { content, councilModels: overrideCouncil, chairmanModel: overrideChairman } = req.body;

  const conversation = storage.getConversation(id, req.userId);
  if (!conversation) return res.status(404).json({ detail: 'Conversation not found' });

  const isFirstMessage = conversation.messages.length === 0;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    storage.addUserMessage(id, req.userId, content);

    // Start title generation in parallel
    let titlePromise = null;
    if (isFirstMessage) {
      titlePromise = generateConversationTitle(content);
    }

    const defaults = getActiveSettings(req.userId);
    const councilModels = (Array.isArray(overrideCouncil) && overrideCouncil.length >= 2) ? overrideCouncil : defaults.councilModels;
    const chairmanModel = (typeof overrideChairman === 'string' && overrideChairman) ? overrideChairman : defaults.chairmanModel;

    // Stage 1
    send({ type: 'stage1_start' });
    const stage1Results = await stage1CollectResponses(content, councilModels);
    send({ type: 'stage1_complete', data: stage1Results });

    // Stage 2
    send({ type: 'stage2_start' });
    const [stage2Results, labelToModel] = await stage2CollectRankings(content, stage1Results, councilModels);
    const aggregateRankings = calculateAggregateRankings(stage2Results, labelToModel);
    send({
      type: 'stage2_complete',
      data: stage2Results,
      metadata: { label_to_model: labelToModel, aggregate_rankings: aggregateRankings },
    });

    // Stage 3
    send({ type: 'stage3_start' });
    const stage3Result = await stage3SynthesizeFinal(content, stage1Results, stage2Results, chairmanModel);
    send({ type: 'stage3_complete', data: stage3Result });

    // Wait for title
    if (titlePromise) {
      const title = await titlePromise;
      storage.updateConversationTitle(id, req.userId, title);
      send({ type: 'title_complete', data: { title } });
    }

    // Save assistant message
    storage.addAssistantMessage(id, req.userId, stage1Results, stage2Results, stage3Result);

    send({ type: 'complete' });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }

  res.end();
});

// --- Vite / Static serving ---

const PORT = 5173;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Development: use Vite dev middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: 'frontend',
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static files
    const { default: path } = await import('path');
    const distPath = path.resolve('frontend/dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`LLM Bullpen running at http://localhost:${PORT}`);
  });
}

startServer();
