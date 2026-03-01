import { queryModel, queryModelsParallel } from './openrouter.js';

/**
 * Stage 1: Collect individual responses from all council models.
 */
export async function stage1CollectResponses(userQuery, councilModels) {
  const messages = [{ role: 'user', content: userQuery }];
  const responses = await queryModelsParallel(councilModels, messages);

  const results = [];
  for (const [model, response] of Object.entries(responses)) {
    if (response !== null) {
      results.push({ model, response: response.content || '' });
    }
  }
  return results;
}

/**
 * Stage 2: Each model ranks the anonymized responses.
 * @returns {[Array, Record<string, string>]} - [rankings, labelToModel]
 */
export async function stage2CollectRankings(userQuery, stage1Results, councilModels) {
  // Create anonymized labels
  const labels = stage1Results.map((_, i) => String.fromCharCode(65 + i));

  const labelToModel = {};
  for (let i = 0; i < stage1Results.length; i++) {
    labelToModel[`Response ${labels[i]}`] = stage1Results[i].model;
  }

  const responsesText = stage1Results
    .map((result, i) => `Response ${labels[i]}:\n${result.response}`)
    .join('\n\n');

  const rankingPrompt = `You are evaluating different responses to the following question:

Question: ${userQuery}

Here are the responses from different models (anonymized):

${responsesText}

Your task:
1. First, evaluate each response individually. For each response, explain what it does well and what it does poorly.
2. Then, at the very end of your response, provide a final ranking.

IMPORTANT: Your final ranking MUST be formatted EXACTLY as follows:
- Start with the line "FINAL RANKING:" (all caps, with colon)
- Then list the responses from best to worst as a numbered list
- Each line should be: number, period, space, then ONLY the response label (e.g., "1. Response A")
- Do not add any other text or explanations in the ranking section

Example of the correct format for your ENTIRE response:

Response A provides good detail on X but misses Y...
Response B is accurate but lacks depth on Z...
Response C offers the most comprehensive answer...

FINAL RANKING:
1. Response C
2. Response A
3. Response B

Now provide your evaluation and ranking:`;

  const messages = [{ role: 'user', content: rankingPrompt }];
  const responses = await queryModelsParallel(councilModels, messages);

  const stage2Results = [];
  for (const [model, response] of Object.entries(responses)) {
    if (response !== null) {
      const fullText = response.content || '';
      const parsed = parseRankingFromText(fullText);
      stage2Results.push({
        model,
        ranking: fullText,
        parsed_ranking: parsed,
      });
    }
  }

  return [stage2Results, labelToModel];
}

/**
 * Stage 3: Chairman synthesizes final response.
 */
export async function stage3SynthesizeFinal(userQuery, stage1Results, stage2Results, chairmanModel) {
  const stage1Text = stage1Results
    .map((r) => `Model: ${r.model}\nResponse: ${r.response}`)
    .join('\n\n');

  const stage2Text = stage2Results
    .map((r) => `Model: ${r.model}\nRanking: ${r.ranking}`)
    .join('\n\n');

  const chairmanPrompt = `You are the Chairman of an LLM Bullpen. Multiple AI models have provided responses to a user's question, and then ranked each other's responses.

Original Question: ${userQuery}

STAGE 1 - Individual Responses:
${stage1Text}

STAGE 2 - Peer Rankings:
${stage2Text}

Your task as Chairman is to synthesize all of this information into a single, comprehensive, accurate answer to the user's original question. Consider:
- The individual responses and their insights
- The peer rankings and what they reveal about response quality
- Any patterns of agreement or disagreement

Provide a clear, well-reasoned final answer that represents the council's collective wisdom:`;

  const messages = [{ role: 'user', content: chairmanPrompt }];
  const response = await queryModel(chairmanModel, messages);

  if (response === null) {
    return {
      model: chairmanModel,
      response: 'Error: Unable to generate final synthesis.',
    };
  }

  return {
    model: chairmanModel,
    response: response.content || '',
  };
}

/**
 * Parse the FINAL RANKING section from a model's response.
 */
export function parseRankingFromText(rankingText) {
  if (rankingText.includes('FINAL RANKING:')) {
    const parts = rankingText.split('FINAL RANKING:');
    if (parts.length >= 2) {
      const rankingSection = parts[1];

      // Try numbered list format: "1. Response A"
      const numberedMatches = rankingSection.match(/\d+\.\s*Response [A-Z]/g);
      if (numberedMatches) {
        return numberedMatches.map((m) => m.match(/Response [A-Z]/)[0]);
      }

      // Fallback: all "Response X" patterns in order
      const matches = rankingSection.match(/Response [A-Z]/g);
      return matches || [];
    }
  }

  // Fallback: any "Response X" patterns
  const matches = rankingText.match(/Response [A-Z]/g);
  return matches || [];
}

/**
 * Calculate aggregate rankings across all models.
 */
export function calculateAggregateRankings(stage2Results, labelToModel) {
  const modelPositions = {};

  for (const ranking of stage2Results) {
    const parsedRanking = parseRankingFromText(ranking.ranking);

    for (let position = 0; position < parsedRanking.length; position++) {
      const label = parsedRanking[position];
      if (label in labelToModel) {
        const modelName = labelToModel[label];
        if (!modelPositions[modelName]) modelPositions[modelName] = [];
        modelPositions[modelName].push(position + 1);
      }
    }
  }

  const aggregate = [];
  for (const [model, positions] of Object.entries(modelPositions)) {
    if (positions.length > 0) {
      const avgRank = positions.reduce((a, b) => a + b, 0) / positions.length;
      aggregate.push({
        model,
        average_rank: Math.round(avgRank * 100) / 100,
        rankings_count: positions.length,
      });
    }
  }

  aggregate.sort((a, b) => a.average_rank - b.average_rank);
  return aggregate;
}

/**
 * Generate a short title for a conversation.
 */
export async function generateConversationTitle(userQuery) {
  const titlePrompt = `Generate a very short title (3-5 words maximum) that summarizes the following question.
The title should be concise and descriptive. Do not use quotes or punctuation in the title.

Question: ${userQuery}

Title:`;

  const messages = [{ role: 'user', content: titlePrompt }];
  const response = await queryModel('google/gemini-2.5-flash', messages, 30000);

  if (response === null) {
    return 'New Conversation';
  }

  let title = (response.content || 'New Conversation').trim();
  title = title.replace(/^["']|["']$/g, '');

  if (title.length > 50) {
    title = title.slice(0, 47) + '...';
  }

  return title;
}

/**
 * Run the complete 3-stage council process.
 * @returns {[Array, Array, Object, Object]}
 */
export async function runFullCouncil(userQuery, councilModels, chairmanModel) {
  const stage1Results = await stage1CollectResponses(userQuery, councilModels);

  if (stage1Results.length === 0) {
    return [
      [],
      [],
      { model: 'error', response: 'All models failed to respond. Please try again.' },
      {},
    ];
  }

  const [stage2Results, labelToModel] = await stage2CollectRankings(userQuery, stage1Results, councilModels);
  const aggregateRankings = calculateAggregateRankings(stage2Results, labelToModel);
  const stage3Result = await stage3SynthesizeFinal(userQuery, stage1Results, stage2Results, chairmanModel);

  const metadata = { label_to_model: labelToModel, aggregate_rankings: aggregateRankings };
  return [stage1Results, stage2Results, stage3Result, metadata];
}
