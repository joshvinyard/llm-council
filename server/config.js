import 'dotenv/config';
import db from './database.js';

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export const COUNCIL_MODELS = [
  'openai/gpt-5.1',
  'google/gemini-3-pro-preview',
  'anthropic/claude-sonnet-4.5',
  'x-ai/grok-4',
];

export const CHAIRMAN_MODEL = 'google/gemini-3-pro-preview';

export const DEFAULT_COUNCIL_MODELS = COUNCIL_MODELS;
export const DEFAULT_CHAIRMAN_MODEL = CHAIRMAN_MODEL;

export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export function getActiveSettings(userId) {
  if (userId) {
    const row = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
    if (row) {
      try {
        const councilModels = JSON.parse(row.council_models);
        if (councilModels && row.chairman_model) {
          return { councilModels, chairmanModel: row.chairman_model };
        }
      } catch {
        // Invalid JSON — fall through to defaults
      }
    }
  }
  return {
    councilModels: DEFAULT_COUNCIL_MODELS,
    chairmanModel: DEFAULT_CHAIRMAN_MODEL,
  };
}
