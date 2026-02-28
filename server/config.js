import 'dotenv/config';

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export const COUNCIL_MODELS = [
  'openai/gpt-5.1',
  'google/gemini-3-pro-preview',
  'anthropic/claude-sonnet-4.5',
  'x-ai/grok-4',
];

export const CHAIRMAN_MODEL = 'google/gemini-3-pro-preview';

export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const DATA_DIR = 'data/conversations';
