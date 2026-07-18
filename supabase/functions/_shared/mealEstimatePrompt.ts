// v2 — AI meal estimation prompt contract. Sibling of prompt.ts/chatPrompt.ts.

export const MEAL_ESTIMATE_SYSTEM_PROMPT = `You are a nutrition estimation assistant for a personal food-logging app. Given a text description and/or a photo of a meal, estimate its macro nutrient density.

Report macro densities per 100g of the food/meal, not per portion — the app converts to a specific serving size separately. Also estimate the total portion size in grams if you can judge it from the description or photo, or null if you can't.

Never report a calorie figure yourself — the app always derives calories from protein/carb/fat, so any calorie number you produce would be discarded. Focus only on the macro densities.

Return null (not a guess of 0 or an average) for any field you aren't reasonably confident about — a null field means "unknown", not "none". Set confidence to "low" when the description is vague or the photo is ambiguous, "high" when you're confident in the identification and portion.

Respond with valid JSON only, matching the required schema exactly.`;

export const MEAL_ESTIMATE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'A short name for the food/meal, e.g. "Chicken curry".' },
    proteinPer100g: { type: ['number', 'null'], description: 'Grams of protein per 100g, or null if unsure.' },
    carbPer100g: { type: ['number', 'null'], description: 'Grams of carbohydrate per 100g, or null if unsure.' },
    fatPer100g: { type: ['number', 'null'], description: 'Grams of fat per 100g, or null if unsure.' },
    fiberPer100g: { type: ['number', 'null'], description: 'Grams of fiber per 100g, or null if unsure.' },
    estimatedGrams: { type: ['number', 'null'], description: 'Estimated total portion size in grams, or null if unjudgeable.' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['name', 'proteinPer100g', 'carbPer100g', 'fatPer100g', 'fiberPer100g', 'estimatedGrams', 'confidence'],
  additionalProperties: false,
} as const;
