// src/utils/score.ts
import type { Mode, Reaction } from "../lib/transport";

export function appliedStrength(base: number, mode: Mode): number {
  switch (mode) {
    case "ehrlich":
      return base;
    case "leicht":
      return base + 2;
    case "stark":
      return base + 4;
    default:
      return base;
  }
}

export function category(eff: number): "weak" | "medium" | "strong" {
  if (eff <= 4) return "weak";
  if (eff <= 7) return "medium";
  return "strong";
}

export function reactionMultiplier(reaction: Reaction): number {
  switch (reaction) {
    case "annehmen":
      return 1.0;
    case "zurückstellen":
      return 0.6;
    case "ablehnen":
      return 0.0;
    default:
      return 1.0;
  }
}

// einfache Vertrauens-Logik (0–100)
export function updateTrust(
  current: number,
  oppMode: Mode,
  reaction: Reaction
): number {
  let delta = 0;

  if (oppMode === "ehrlich") {
    if (reaction === "annehmen") delta += 6;
    if (reaction === "zurückstellen") delta -= 2;
    if (reaction === "ablehnen") delta -= 6;
  } else if (oppMode === "leicht") {
    if (reaction === "annehmen") delta += 3;
    if (reaction === "zurückstellen") delta += 0;
    if (reaction === "ablehnen") delta -= 3;
  } else if (oppMode === "stark") {
    if (reaction === "annehmen") delta += 0;
    if (reaction === "zurückstellen") delta -= 1;
    if (reaction === "ablehnen") delta += 2; // „Bluff erkannt“
  }

  const next = Math.max(0, Math.min(100, current + delta));
  return next;
}