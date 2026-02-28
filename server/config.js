import 'dotenv/config';
import fs from 'fs/promises';

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

export const DATA_DIR = 'data/conversations';

export async function getActiveSettings() {
  try {
    const data = await fs.readFile('data/settings.json', 'utf-8');
    const settings = JSON.parse(data);
    if (settings.councilModels && settings.chairmanModel) {
      return {
        councilModels: settings.councilModels,
        chairmanModel: settings.chairmanModel,
      };
    }
  } catch {
    // No settings file or invalid — use defaults
  }
  return {
    councilModels: DEFAULT_COUNCIL_MODELS,
    chairmanModel: DEFAULT_CHAIRMAN_MODEL,
  };
}
