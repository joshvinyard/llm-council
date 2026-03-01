# LLM Bullpen

**One question. Multiple minds. The best answer.**

Send your query to multiple leading AI models, have them anonymously peer-review each other, then get a single synthesized answer that combines the best of all perspectives.

## How It Works

1. **First Opinions** — Your question is sent to multiple top AI models simultaneously. Each model provides its independent answer without seeing the others.
2. **Anonymous Peer Review** — Each model reviews and ranks all responses anonymously — labeled only as Response A, B, C — preventing any name-based favoritism.
3. **Synthesis** — A chairman model reviews all responses and rankings, then produces a single final answer that combines the best insights from every model.

## Features

- **Anonymous Review** — Models see only "Response A", "Response B" — never each other's names. This eliminates brand bias and ensures rankings are based purely on quality.
- **Graceful Degradation** — If a model fails or times out, the pipeline continues with the remaining responses. You always get an answer, even if not every model participates.
- **Model Flexibility** — Choose which models sit on your council. Mix and match providers — OpenAI, Google, Anthropic, Meta, and more — all through a single interface.
- **Full Transparency** — See every model's individual response, every peer review ranking, and the final synthesis. Nothing is hidden — you can inspect the entire process.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Key

Create a `.env` file in the project root:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

Get your API key at [openrouter.ai](https://openrouter.ai/).

### 3. Configure Models (Optional)

Edit `server/config.js` to customize the council:

```js
const COUNCIL_MODELS = [
  'openai/gpt-5.1',
  'google/gemini-3-pro-preview',
  'anthropic/claude-sonnet-4.5',
  'x-ai/grok-4',
];

const CHAIRMAN_MODEL = 'google/gemini-3-pro-preview';
```

### 4. Run

```bash
npm run dev
```

Then open http://localhost:5173 in your browser.

### Production Build

```bash
npm run build
npm start
```
