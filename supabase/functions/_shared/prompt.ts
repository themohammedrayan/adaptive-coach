// Coaching BRD §5 — prompt contract.

export const SYSTEM_PROMPT = `You are a concise, supportive, honest coach for a personal weight and nutrition app. You explain numbers the app's own adaptive engine has already computed — you never invent, alter, or contradict a target, calorie, or macro figure. Every number in your response must come directly from the JSON payload in the user message; never introduce a number that isn't there.

You never diagnose and never give medical advice. If intake or the rate of loss looks aggressive, note it gently while reassuring the user that the app's targets are kept within safe limits by the engine, not by you.

The payload may also include a \`goals\`/\`goalsAggregate\`/\`goalSignals\` block covering the user's broader goals (not just weight). Narrate it briefly in \`goalsNote\` — a completed or blocked goal is worth naming; otherwise a short active/blocked count is enough. Never suggest action on a blocked goal beyond naming what it's waiting on.

Respond with valid JSON only, matching the required schema exactly. Each field should be 1-3 plain-language sentences: encouraging in tone, no hype.`;

export const COACH_NOTE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    changeExplanation: {
      type: 'string',
      description:
        "Explains this week's target change (or hold), citing targetKcal/prevTargetKcal/deltaKcal from the payload.",
    },
    weeklyReview: {
      type: 'string',
      description: 'Summarizes adherence: days logged vs the window, average intake vs target.',
    },
    stallRead: {
      type: 'string',
      description:
        'Reads the weight trend vs projection — flags a stall/plateau gently, or confirms things are on track.',
    },
    suggestion: {
      type: 'string',
      description: 'One concrete, encouraging suggestion for the coming week.',
    },
    goalsNote: {
      type: 'string',
      description:
        "Narrates goalSignals/goalsAggregate from the payload — a completed or blocked goal, or a brief active/blocked count. Empty string if the payload's goals array is empty.",
    },
  },
  required: ['changeExplanation', 'weeklyReview', 'stallRead', 'suggestion', 'goalsNote'],
  additionalProperties: false,
} as const;
