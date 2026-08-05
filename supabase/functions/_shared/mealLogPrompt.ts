// Conversational meal logging — sibling of mealEstimatePrompt.ts. Where
// estimate-meal turns one description into one food, this turns a sentence
// ("two rotis, dal and a katori of rice") into a list of items, each either
// matched to a food the user already has or proposed as a new one.

/** Mirrors src/food-log/constants.ts's DEFAULT_UNITS. Keep in sync by hand. */
export const KNOWN_UNIT_IDS = [
  'gram',
  'ml',
  'katori',
  'roti',
  'piece',
  'tbsp',
  'tsp',
  'glass',
  'cup',
  'plate',
] as const;

export const MEAL_LOG_SYSTEM_PROMPT = `You are a meal-logging assistant for a personal food-logging app. The user tells you what they ate, in one sentence and/or a photo. Split it into individual food items and, for each, give a portion and macro densities.

You will be given the user's existing food catalog as a list of {catalogId, name}. For each item, first try to match it to an entry in that catalog:
- If an entry clearly refers to the same food, set matchedCatalogId to its catalogId. The app will reuse that food's saved macros and you may leave the macro fields null.
- Otherwise set matchedCatalogId to null and fill in the macro densities, because the app will have to create a new food.
Never invent a catalogId. Only ever use one that appears verbatim in the catalog you were given.

Report macro densities per 100g of the food, not per portion — the app converts to the serving size separately. Never report a calorie figure when you know protein/carb/fat: the app always derives calories as 4*protein + 4*carb + 9*fat, so any calorie number you produce alongside macros would be discarded. Only set kcalPer100g when you genuinely cannot break the food into macros; in that case leave protein, carb and fat null.

For the portion, use quantity plus one of these unitIds: ${KNOWN_UNIT_IDS.join(', ')}. Pick the unit a person would actually say — "2 roti", "1 katori", "250 ml" — and fall back to gram with an explicit weight when nothing else fits. gramsPerUnit is your estimate of what one of that unit weighs for this food, or null if you have no view.

Return null (not a guess of 0 or an average) for any macro field you aren't reasonably confident about — null means "unknown", not "none". Set confidence per item: "low" when the description is vague or the photo ambiguous, "high" when you are sure of both the food and the portion.

If something essential is genuinely unclear — an unstated portion size that changes the answer a lot — put one short question in clarification. Otherwise set clarification to null. Do not use clarification for commentary, encouragement, or nutrition advice.

Respond with valid JSON only, matching the required schema exactly.`;

export const MEAL_LOG_JSON_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      description: 'One entry per distinct food the user described.',
      items: {
        type: 'object',
        properties: {
          matchedCatalogId: {
            type: ['string', 'null'],
            description: 'A catalogId copied verbatim from the supplied catalog, or null for a new food.',
          },
          name: { type: 'string', description: 'A short name for the food, e.g. "Dal".' },
          quantity: { type: 'number', description: 'How many of unitId were eaten.' },
          unitId: { type: 'string', enum: [...KNOWN_UNIT_IDS] },
          gramsPerUnit: {
            type: ['number', 'null'],
            description: 'Estimated weight in grams of one unitId of this food, or null.',
          },
          proteinPer100g: { type: ['number', 'null'], description: 'Grams of protein per 100g, or null if unsure.' },
          carbPer100g: { type: ['number', 'null'], description: 'Grams of carbohydrate per 100g, or null if unsure.' },
          fatPer100g: { type: ['number', 'null'], description: 'Grams of fat per 100g, or null if unsure.' },
          fiberPer100g: { type: ['number', 'null'], description: 'Grams of fiber per 100g, or null if unsure.' },
          kcalPer100g: {
            type: ['number', 'null'],
            description: 'Only when macros are unknown. Null whenever protein/carb/fat are given.',
          },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: [
          'matchedCatalogId',
          'name',
          'quantity',
          'unitId',
          'gramsPerUnit',
          'proteinPer100g',
          'carbPer100g',
          'fatPer100g',
          'fiberPer100g',
          'kcalPer100g',
          'confidence',
        ],
        additionalProperties: false,
      },
    },
    clarification: {
      type: ['string', 'null'],
      description: 'One short question when a portion is genuinely ambiguous, else null.',
    },
  },
  required: ['items', 'clarification'],
  additionalProperties: false,
} as const;
