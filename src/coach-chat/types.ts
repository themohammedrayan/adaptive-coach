/** v2 — ad-hoc coach Q&A. RN-side mirror of supabase/functions/_shared/types.ts's CoachChatTurn. */
export interface CoachChatTurn {
  id: string;
  question: string;
  answer: string;
  source: 'model' | 'fallback';
  model: string | null;
  generatedAt: string;
  payloadHash: string;
}

export interface ChatHistoryTurn {
  question: string;
  answer: string;
}
