// src/utils/analyze.ts
// Scoring + erweiterte Analyse/Interpretation

export type Team = "A" | "B";
export type Mode = "ehrlich" | "leicht" | "stark";
export type Reaction = "annehmen" | "zurückstellen" | "ablehnen";

export interface RoundRecord {
  round: number;
  A?: { s: number; mode: Mode; eff: number; cat: "weak" | "medium" | "strong" };
  B?: { s: number; mode: Mode; eff: number; cat: "weak" | "medium" | "strong" };
  reactA?: Reaction;
  reactB?: Reaction;
  deltaA?: number;
  deltaB?: number;
  trustA?: number;
  trustB?: number;
}

export const effectBoost: Record<Mode, number> = {
  ehrlich: 0,
  leicht: 1,
  stark: 2,
};

export const reactMul: Record<Reaction, number> = {
  annehmen: 1.0,
  "zurückstellen": 0.8,
  ablehnen: 0.5,
};

export function appliedStrength(s: number, mode: Mode) {
  return s + effectBoost[mode];
}

export function category(val: number): "weak" | "medium" | "strong" {
  if (val <= 4) return "weak";
  if (val <= 7) return "medium";
  return "strong";
}

export function reactionMultiplier(r: Reaction) {
  return reactMul[r];
}

/** Trust-Update (0–100), bewusst simpel gehalten. */
export function updateTrust(
  prev: number,
  params: {
    myMode?: Mode;
    oppReact?: Reaction;
    iTrusted?: boolean;      // ehrlich gespielt oder angenommen
    oppBluffed?: boolean;    // Gegner hat nicht „ehrlich“ gespielt
  }
): number {
  let t = prev;

  if (params.oppReact === "annehmen") t += 3;
  if (params.oppReact === "zurückstellen") t -= 2;
  if (params.oppReact === "ablehnen") t -= 4;

  if (params.iTrusted) t += 2;
  if (params.myMode === "stark") t -= 1; // häufiger Bluff lässt Vertrauen sinken

  if (t < 0) t = 0;
  if (t > 100) t = 100;
  return t;
}

/** Prozent-Helfer (0–100). */
export function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

/** Erweiterte, aber leichte Heuristik-Auswertung. */
export function interpretSummaryPlus(
  history: RoundRecord[],
  totals: Record<Team, number>,
  trustFinal: Record<Team, number>
) {
  const stats = {
    A: { honest: 0, light: 0, strong: 0, accept: 0, defer: 0, reject: 0, oppStrongSeen: 0, counterRejectOnStrong: 0 },
    B: { honest: 0, light: 0, strong: 0, accept: 0, defer: 0, reject: 0, oppStrongSeen: 0, counterRejectOnStrong: 0 },
  };

  let trustStartA = 60, trustStartB = 60;

  for (const r of history) {
    if (r.round === 1) {
      if (typeof r.trustA === "number") trustStartA = r.trustA;
      if (typeof r.trustB === "number") trustStartB = r.trustB;
    }
    if (r.A) {
      if (r.A.mode === "ehrlich") stats.A.honest++;
      if (r.A.mode === "leicht") stats.A.light++;
      if (r.A.mode === "stark")  stats.A.strong++;
    }
    if (r.B) {
      if (r.B.mode === "ehrlich") stats.B.honest++;
      if (r.B.mode === "leicht") stats.B.light++;
      if (r.B.mode === "stark")  stats.B.strong++;
    }
    if (r.reactA) {
      if (r.reactA === "annehmen") stats.A.accept++;
      if (r.reactA === "zurückstellen") stats.A.defer++;
      if (r.reactA === "ablehnen") stats.A.reject++;
    }
    if (r.reactB) {
      if (r.reactB === "annehmen") stats.B.accept++;
      if (r.reactB === "zurückstellen") stats.B.defer++;
      if (r.reactB === "ablehnen") stats.B.reject++;
    }
    // Opportunität: Gegner „strong/medium“ → Ablehnen als Schutzreaktion
    if (r.B && r.B.cat === "strong") { stats.A.oppStrongSeen++; if (r.reactA === "ablehnen") stats.A.counterRejectOnStrong++; }
    if (r.A && r.A.cat === "strong") { stats.B.oppStrongSeen++; if (r.reactB === "ablehnen") stats.B.counterRejectOnStrong++; }
  }

  const playsA = stats.A.honest + stats.A.light + stats.A.strong;
  const playsB = stats.B.honest + stats.B.light + stats.B.strong;
  const reactsA = stats.A.accept + stats.A.defer + stats.A.reject;
  const reactsB = stats.B.accept + stats.B.defer + stats.B.reject;

  function teamBlock(side: Team) {
    const S = stats[side];
    const plays = side === "A" ? playsA : playsB;
    const reacts = side === "A" ? reactsA : reactsB;
    const trustStart = side === "A" ? trustStartA : trustStartB;
    const trustEnd = trustFinal[side];
    const trustDelta = trustEnd - trustStart;

    const riskIdx = pct(S.light + S.strong, plays);     // Übertreibungsanteil
    const fairIdx = pct(S.honest, plays);               // Fair/Ehrlich-Anteil
    const consIdx = 100 - pct(Math.min(S.honest, S.light) + Math.min(S.light, S.strong) + Math.min(S.honest, S.strong), plays); // ganz grob
    const acceptRate = pct(S.accept, reacts);
    const deferRate  = pct(S.defer, reacts);
    const rejectRate = pct(S.reject, reacts);
    const counterOnStrong = S.oppStrongSeen ? pct(S.counterRejectOnStrong, S.oppStrongSeen) : 0;

    const style =
      S.strong > S.honest && S.strong > S.light ? "konfrontativ/pointiert" :
      S.honest >= S.light && S.honest >= S.strong ? "kooperativ-fair" :
      "taktisch variabel";

    return [
      `• Stil: **${style}** · Risiko-Index (Übertreibung): **${riskIdx}%** · Fair-Index (ehrlich): **${fairIdx}%** · Konsistenz: **${consIdx}%**`,
      `• Reaktionen: Annehmen **${acceptRate}%**, Zurückstellen **${deferRate}%**, Ablehnen **${rejectRate}%**`,
      `• Schutz gegen starke Züge des Gegners (Ablehnen bei „strong“): **${counterOnStrong}%**`,
      `• Vertrauen: Start **${trustStart}**, Ende **${trustEnd}** (Δ **${trustDelta}**)`,
    ].join("\n");
  }

  const headToHead =
    totals.A === totals.B
      ? "Gesamt: **Unentschieden**."
      : totals.A > totals.B
      ? "Gesamt: **Team A** hat beim Score die Nase vorn."
      : "Gesamt: **Team B** hat beim Score die Nase vorn.";

  const advies =
    "- Hoher Zurückstell-Anteil = niedrige Chancenverwertung und Vertrauensdämpfer. " +
    "Mehr selektiv annehmen (v.a. bei schwachen/mittleren Zügen des Gegners).\n" +
    "- Häufige starke Übertreibung bringt kurzfristig Punkte, kann aber Vertrauen kosten. " +
    "Bewusst variieren und ehrliche Züge in Schlüsselmomenten nutzen.\n" +
    "- Beobachte Muster der Gegenseite (wann ehrlich/strong?) und passe Reaktionen an.";

  return [
    headToHead,
    "",
    "### Team A",
    teamBlock("A"),
    "",
    "### Team B",
    teamBlock("B"),
    "",
    "### Hinweise",
    advies,
  ].join("\n");
}