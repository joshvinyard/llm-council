import express from 'express';
import { randomUUID } from 'crypto';
import * as storage from './storage.js';
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

// --- API Routes ---

app.get('/api/conversations', async (req, res) => {
  const conversations = await storage.listConversations();
  res.json(conversations);
});

app.post('/api/conversations', async (req, res) => {
  const id = randomUUID();
  const conversation = await storage.createConversation(id);
  res.json(conversation);
});

app.get('/api/conversations/:id', async (req, res) => {
  const conversation = await storage.getConversation(req.params.id);
  if (!conversation) return res.status(404).json({ detail: 'Conversation not found' });
  res.json(conversation);
});

app.post('/api/conversations/:id/message', async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  const conversation = await storage.getConversation(id);
  if (!conversation) return res.status(404).json({ detail: 'Conversation not found' });

  const isFirstMessage = conversation.messages.length === 0;

  await storage.addUserMessage(id, content);

  if (isFirstMessage) {
    const title = await generateConversationTitle(content);
    await storage.updateConversationTitle(id, title);
  }

  const [stage1Results, stage2Results, stage3Result, metadata] = await runFullCouncil(content);

  await storage.addAssistantMessage(id, stage1Results, stage2Results, stage3Result);

  res.json({ stage1: stage1Results, stage2: stage2Results, stage3: stage3Result, metadata });
});

app.post('/api/conversations/:id/message/stream', async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  const conversation = await storage.getConversation(id);
  if (!conversation) return res.status(404).json({ detail: 'Conversation not found' });

  const isFirstMessage = conversation.messages.length === 0;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    await storage.addUserMessage(id, content);

    // Start title generation in parallel
    let titlePromise = null;
    if (isFirstMessage) {
      titlePromise = generateConversationTitle(content);
    }

    // Stage 1
    send({ type: 'stage1_start' });
    const stage1Results = await stage1CollectResponses(content);
    send({ type: 'stage1_complete', data: stage1Results });

    // Stage 2
    send({ type: 'stage2_start' });
    const [stage2Results, labelToModel] = await stage2CollectRankings(content, stage1Results);
    const aggregateRankings = calculateAggregateRankings(stage2Results, labelToModel);
    send({
      type: 'stage2_complete',
      data: stage2Results,
      metadata: { label_to_model: labelToModel, aggregate_rankings: aggregateRankings },
    });

    // Stage 3
    send({ type: 'stage3_start' });
    const stage3Result = await stage3SynthesizeFinal(content, stage1Results, stage2Results);
    send({ type: 'stage3_complete', data: stage3Result });

    // Wait for title
    if (titlePromise) {
      const title = await titlePromise;
      await storage.updateConversationTitle(id, title);
      send({ type: 'title_complete', data: { title } });
    }

    // Save assistant message
    await storage.addAssistantMessage(id, stage1Results, stage2Results, stage3Result);

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
    console.log(`LLM Council running at http://localhost:${PORT}`);
  });
}

startServer();
