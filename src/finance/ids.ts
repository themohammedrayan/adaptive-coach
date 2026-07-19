export type IdGenerator = () => string;

export const defaultGenId: IdGenerator = () =>
  `fin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
