// src/utils/deal.ts
export type Arg = {
  id: string;
  label: string;
  s: number; // Basisstärke
};

export function dealHand(): Arg[] {
  // 8 Argumente mit verschiedenen Stärken
  const bases = [2, 3, 4, 5, 6, 7, 8, 9];
  return bases.map((s, idx) => ({
    id: `ARG${idx + 1}`,
    label: `Argument ${idx + 1}`,
    s,
  }));
}