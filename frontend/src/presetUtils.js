/**
 * Auto-generate suggested model group presets based on OpenRouter pricing tiers.
 *
 * @param {Array} models — full model list from OpenRouter (each has .id, .pricing.prompt, .created)
 * @returns {Array} suggested presets with { id, name, councilModels, chairmanModel, isSuggested }
 */
export function generateSuggestedPresets(models) {
  const eighteenMonthsAgo = Date.now() / 1000 - 18 * 30 * 24 * 60 * 60;

  // Filter to models with pricing and reasonably recent
  const eligible = models.filter((m) => {
    const price = parseFloat(m.pricing?.prompt);
    if (price == null || isNaN(price)) return false;
    if (m.created && m.created < eighteenMonthsAgo) return false;
    return true;
  });

  const tiers = [
    {
      id: 'suggested-free-budget',
      name: 'Free / Budget',
      filter: (m) => parseFloat(m.pricing.prompt) <= 0.000001,
    },
    {
      id: 'suggested-standard',
      name: 'Standard',
      filter: (m) => {
        const p = parseFloat(m.pricing.prompt);
        return p > 0.000001 && p < 0.000005;
      },
    },
    {
      id: 'suggested-premium',
      name: 'Premium',
      filter: (m) => parseFloat(m.pricing.prompt) >= 0.000005,
    },
  ];

  const presets = [];

  for (const tier of tiers) {
    const tierModels = eligible
      .filter(tier.filter)
      .sort((a, b) => (b.created || 0) - (a.created || 0));

    if (tierModels.length < 2) continue;

    const councilModels = tierModels.slice(0, 4).map((m) => m.id);
    const chairmanModel = tierModels[0].id;

    presets.push({
      id: tier.id,
      name: tier.name,
      councilModels,
      chairmanModel,
      isSuggested: true,
    });
  }

  return presets;
}
