import { OPENROUTER_API_KEY, OPENROUTER_API_URL } from './config.js';

/**
 * Query a single model via OpenRouter API.
 * @param {string} model - OpenRouter model identifier
 * @param {Array<{role: string, content: string}>} messages
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<{content: string, reasoning_details?: any} | null>}
 */
export async function queryModel(model, messages, timeout = 120000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    return {
      content: message.content ?? null,
      reasoning_details: message.reasoning_details ?? undefined,
    };
  } catch (err) {
    console.error(`Error querying model ${model}:`, err.message);
    return null;
  }
}

/**
 * Query multiple models in parallel.
 * @param {string[]} models
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Promise<Record<string, {content: string} | null>>}
 */
export async function queryModelsParallel(models, messages) {
  const results = await Promise.all(
    models.map((model) => queryModel(model, messages))
  );

  const mapped = {};
  for (let i = 0; i < models.length; i++) {
    mapped[models[i]] = results[i];
  }
  return mapped;
}
