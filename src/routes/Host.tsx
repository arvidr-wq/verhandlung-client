// src/routes/Host.tsx
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  subscribeHost,
  sendReveal,
  sendNext,
  resetSession,
  sendStateUpdate,
  type AnyMsg,
  type Team,
  type StateSnapshot
} from "../lib/transport";

type TeamState = {
  score: number;
  fairScore: number;
  trust: number;
};

type InternalState = {
  played: Partial<Record<Team, { base: number; mode: string }>>;
  reacted: Partial<Record<Team, string>>;
  trustInvest: Partial<Record<Team, number>>; // 0–10 %
};

type RoundSide = {
  base?: number;
  mode?: "fair" | "leicht" | "deutlich";
  reaction?: "annehmen" | "zurückstellen" | "ablehnen";
  trustBefore?: number;
  trustAfter?: number;
  invest?: number; // nur in Trust-Runden
};

type RoundRecord = {
  round: number;
  A: RoundSide;
  B: RoundSide;
};

const TOTAL_ROUNDS = 10;

function initialTeam(): TeamState {
  return { score: 0, fairScore: 0, trust: 50 };
}

function initialInternal(): InternalState {
  return {
    played: {},
    reacted: {},
    trustInvest: {}
  };
}

// ----------------- Scoring-Helfer -----------------

function effectiveStrength(base: number, mode: string): number {
  let bonus = 0;
  if (mode === "leicht") bonus = 2;
  if (mode === "deutlich") bonus = 4;
  return Math.max(1, Math.min(10, base + bonus));
}

function categoryOf(str: number): "weak" | "medium" | "strong" {
  if (str <= 3) return "weak";
  if (str <= 7) return "medium";
  return "strong";
}

function scoreDelta(reaction: string, eff: number): number {
  if (reaction === "annehmen") return eff;
  if (reaction === "zurückstellen") return eff * 0.3;
  return -eff * 0.5;
}

function trustDelta(reaction: string, ownMode: string): number {
  if (reaction === "annehmen") {
    if (ownMode === "fair") return +8;
    if (ownMode === "leicht") return +5;
    if (ownMode === "deutlich") return +2;
    return +5;
  }
  if (reaction === "zurückstellen") {
    if (ownMode === "fair") return -2;
    if (ownMode === "leicht") return -1;
    if (ownMode === "deutlich") return 0;
    return -1;
  }
  // ablehnen
  if (ownMode === "fair") return -10;
  if (ownMode === "leicht") return -5;
  if (ownMode === "deutlich") return -2;
  return -5;
}

function applyRound(
  internal: InternalState,
  A: TeamState,
  B: TeamState
) {
  const pA = internal.played["A"];
  const pB = internal.played["B"];
  const rA = internal.reacted["A"];
  const rB = internal.reacted["B"];
  if (!pA || !pB || !rA || !rB) return;

  const effA = effectiveStrength(pA.base, pA.mode);
  const effB = effectiveStrength(pB.base, pB.mode);

  const dAScore = scoreDelta(rB, effA);
  const dATrust = trustDelta(rB, pA.mode);

  const dBScore = scoreDelta(rA, effB);
  const dBTrust = trustDelta(rA, pB.mode);

  A.score += dAScore;
  B.score += dBScore;

  A.trust = Math.max(0, Math.min(100, A.trust + dATrust));
  B.trust = Math.max(0, Math.min(100, B.trust + dBTrust));

  A.fairScore += pA.base;
  B.fairScore += pB.base;
}

function applyTrustRound(
  internal: InternalState,
  A: TeamState,
  B: TeamState
) {
  const pA = internal.trustInvest["A"] ?? 0;
  const pB = internal.trustInvest["B"] ?? 0;

  const costA = (A.score * pA) / 100;
  const costB = (B.score * pB) / 100;

  A.score -= costA;
  B.score -= costB;

  let deltaTrustForA = pB * 2;
  let deltaTrustForB = pA * 2;

  if (pA > 0 && pB > 0) {
    const common = Math.min(pA, pB);
    deltaTrustForA += common;
    deltaTrustForB += common;
  }

  A.trust = Math.max(0, Math.min(100, A.trust + deltaTrustForA));
  B.trust = Math.max(0, Math.min(100, B.trust + deltaTrustForB));
}

function clampPercent(v: number): number {
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

// ----------------- Auswertungs-Helfer -----------------

function computeSummaryForTeam(
  history: RoundRecord[],
  team: Team
): StateSnapshot["summary"] {
  const opp: Team = team === "A" ? "B" : "A";

  const normalRounds = history.filter(
    (r) => r[team].reaction !== undefined
  );

  // Kooperation
  let acc = 0,
    delay = 0,
    rej = 0;
  for (const r of normalRounds) {
    const react = r[team].reaction;
    if (!react) continue;
    if (react === "annehmen") acc++;
    else if (react === "zurückstellen") delay++;
    else if (react === "ablehnen") rej++;
  }
  const totalReact = acc + delay + rej || 1;
  const coopRaw =
    (2 * acc + 1 * delay) / (2 * totalReact); // 0–1
  let cooperation = clampPercent(coopRaw * 100);

  // Fairness
  let fair = 0,
    light = 0,
    strong = 0;
  for (const r of normalRounds) {
    const m = r[team].mode;
    if (!m) continue;
    if (m === "fair") fair++;
    else if (m === "leicht") light++;
    else if (m === "deutlich") strong++;
  }
  const totalMode = fair + light + strong || 1;
  const fairRaw =
    (fair + 0.5 * light) / totalMode; // 0–1
  let fairness = clampPercent(fairRaw * 100);

  // Reaktionssensibilität
  let lowTotal = 0,
    lowAcc = 0;
  let highTotal = 0,
    highAcc = 0;
  for (const r of normalRounds) {
    const trustOpp = r[opp].trustBefore;
    const react = r[team].reaction;
    if (trustOpp === undefined || !react) continue;

    if (trustOpp < 40) {
      lowTotal++;
      if (react === "annehmen") lowAcc++;
    } else if (trustOpp > 60) {
      highTotal++;
      if (react === "annehmen") highAcc++;
    }
  }
  let qLow = lowTotal > 0 ? lowAcc / lowTotal : 0.5;
  let qHigh = highTotal > 0 ? highAcc / highTotal : 0.5;
  const sensRaw = (qHigh - qLow + 1) / 2; // 0–1
  let sensitivity = clampPercent(sensRaw * 100);

  // Opportunismus
  let highTrustRounds = 0;
  let oppPoints = 0;
  for (const r of normalRounds) {
    const tSelf = r[team].trustBefore;
    if (tSelf === undefined || tSelf <= 60) continue;

    highTrustRounds++;

    const m = r[team].mode;
    const react = r[team].reaction;
    const oppBase = r[opp].base ?? 0;

    if (m === "leicht" || m === "deutlich") oppPoints++;
    if (react === "ablehnen" && oppBase >= 5) oppPoints++;
  }
  const maxPoints = highTrustRounds * 2 || 1;
  const oppRaw = oppPoints / maxPoints; // 0–1
  let opportunism = clampPercent(oppRaw * 100);

  return { cooperation, fairness, sensitivity, opportunism };
}

export default function Host() {
  const [sp] = useSearchParams();
  const session = sp.get("s") ?? "TEST";

  const [round, setRound] = useState(1);
  const roundRef = useRef(1);

  const [teamA, setTeamA] = useState<TeamState>(initialTeam);
  const [teamB, setTeamB] = useState<TeamState>(initialTeam);
  const [log, setLog] = useState<string[]>([]);

  const internalRef = useRef<InternalState>(initialInternal());
  const teamsRef = useRef<{ A: TeamState; B: TeamState }>({
    A: initialTeam(),
    B: initialTeam()
  });
  const historyRef = useRef<RoundRecord[]>([]);

  const [summaryA, setSummaryA] =
    useState<StateSnapshot["summary"] | null>(null);
  const [summaryB, setSummaryB] =
    useState<StateSnapshot["summary"] | null>(null);

  const setRoundSafe = (n: number) => {
    roundRef.current = n;
    setRound(n);
  };

  const logLine = (msg: string) =>
    setLog((l) => [msg, ...l]);

  const getRecord = (round: number): RoundRecord => {
    const idx = round - 1;
    if (!historyRef.current[idx]) {
      historyRef.current[idx] = {
        round,
        A: {},
        B: {}
      };
    }
    return historyRef.current[idx];
  };

  const updateTrustMarkers = (
    round: number,
    Acur: TeamState,
    Bcur: TeamState
  ) => {
    const rec = getRecord(round);
    rec.A.trustAfter = Acur.trust;
    rec.B.trustAfter = Bcur.trust;

    const next = round + 1;
    if (next <= TOTAL_ROUNDS) {
      const nextRec = getRecord(next);
      if (nextRec.A.trustBefore === undefined)
        nextRec.A.trustBefore = Acur.trust;
      if (nextRec.B.trustBefore === undefined)
        nextRec.B.trustBefore = Bcur.trust;
    }
  };

  const finalizeGame = (Acur: TeamState, Bcur: TeamState) => {
    const history = historyRef.current;
    const sA = computeSummaryForTeam(history, "A");
    const sB = computeSummaryForTeam(history, "B");
    setSummaryA(sA);
    setSummaryB(sB);

    const snapA: StateSnapshot = {
      score: Acur.score,
      fairScore: Acur.fairScore,
      trust: Acur.trust,
      summary: sA
    };
    const snapB: StateSnapshot = {
      score: Bcur.score,
      fairScore: Bcur.fairScore,
      trust: Bcur.trust,
      summary: sB
    };
    sendStateUpdate(session, snapA, snapB);
    logLine("Spiel beendet – Auswertung berechnet.");
  };

  const goToNextRound = (Acur: TeamState, Bcur: TeamState) => {
    const current = roundRef.current;
    if (current >= TOTAL_ROUNDS) {
      finalizeGame(Acur, Bcur);
      return;
    }
    const next = current + 1;
    setRoundSafe(next);
    sendNext(session, next);
    logLine(`Runde ${current} ausgewertet`);
  };

  const resetAllLocal = () => {
    const A0 = initialTeam();
    const B0 = initialTeam();
    const internal = initialInternal();
    internalRef.current = internal;
    teamsRef.current = { A: A0, B: B0 };
    historyRef.current = [];

    const rec1 = getRecord(1);
    rec1.A.trustBefore = A0.trust;
    rec1.B.trustBefore = B0.trust;

    setTeamA(A0);
    setTeamB(B0);
    setRoundSafe(1);
    setSummaryA(null);
    setSummaryB(null);
    setLog(["Session zurückgesetzt"]);
    sendStateUpdate(session, A0, B0);
  };

  useEffect(() => {
    resetAllLocal();

    const stop = subscribeHost(session, (msg: AnyMsg) => {
      const internal = internalRef.current;
      const currentRound = roundRef.current;
      const isTrustRound = currentRound === 4 || currentRound === 8;

      // Trust-Runden
      if (msg.type === "trustInvest") {
        if (!isTrustRound) return;

        internal.trustInvest[msg.who] = msg.amount;
        const rec = getRecord(currentRound);
        rec[msg.who].invest = msg.amount;
        logLine(`Team ${msg.who} investiert ${msg.amount}% in Trust`);

        if (
          internal.trustInvest["A"] !== undefined &&
          internal.trustInvest["B"] !== undefined
        ) {
          const Acur: TeamState = { ...teamsRef.current.A };
          const Bcur: TeamState = { ...teamsRef.current.B };

          applyTrustRound(internal, Acur, Bcur);

          teamsRef.current = { A: Acur, B: Bcur };
          setTeamA(Acur);
          setTeamB(Bcur);

          updateTrustMarkers(currentRound, Acur, Bcur);

          goToNextRound(Acur, Bcur);

          internal.trustInvest = {};
        }
        return;
      }

      // normale Runden
      if (!isTrustRound) {
        if (msg.type === "played") {
          internal.played[msg.who] = {
            base: msg.base,
            mode: msg.mode
          };
          const rec = getRecord(currentRound);
          rec[msg.who].base = msg.base;
          rec[msg.who].mode = msg.mode;
          logLine(
            `Team ${msg.who} spielt Stärke ${msg.base} (${msg.mode})`
          );

          if (internal.played["A"] && internal.played["B"]) {
            const cA = categoryOf(
              effectiveStrength(
                internal.played["B"]!.base,
                internal.played["B"]!.mode
              )
            );
            const cB = categoryOf(
              effectiveStrength(
                internal.played["A"]!.base,
                internal.played["A"]!.mode
              )
            );

            sendReveal(session, "A", cA);
            sendReveal(session, "B", cB);
            logLine("Reveal gesendet");
          }
        }

        if (msg.type === "react") {
          internal.reacted[msg.who] = msg.reaction;
          const rec = getRecord(currentRound);
          rec[msg.who].reaction = msg.reaction;
          logLine(
            `Team ${msg.who} reagiert: ${msg.reaction}`
          );

          if (
            internal.reacted["A"] &&
            internal.reacted["B"] &&
            internal.played["A"] &&
            internal.played["B"]
          ) {
            const Acur: TeamState = { ...teamsRef.current.A };
            const Bcur: TeamState = { ...teamsRef.current.B };

            applyRound(internal, Acur, Bcur);

            teamsRef.current = { A: Acur, B: Bcur };
            setTeamA(Acur);
            setTeamB(Bcur);

            updateTrustMarkers(currentRound, Acur, Bcur);

            const snapA: StateSnapshot = {
              score: Acur.score,
              fairScore: Acur.fairScore,
              trust: Acur.trust
            };
            const snapB: StateSnapshot = {
              score: Bcur.score,
              fairScore: Bcur.fairScore,
              trust: Bcur.trust
            };
            sendStateUpdate(session, snapA, snapB);

            internal.played = {};
            internal.reacted = {};

            goToNextRound(Acur, Bcur);
          }
        }
      }

      if (msg.type === "reset") {
        resetAllLocal();
      }
    });

    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const renderSummaryBox = (
    title: string,
    summary: StateSnapshot["summary"] | null
  ) => {
    if (!summary) return null;
    const { cooperation, fairness, sensitivity, opportunism } = summary;

    const level = (v: number, highIsGood: boolean) => {
      if (v < 33) return highIsGood ? "niedrig" : "hoch";
      if (v < 66) return "mittel";
      return highIsGood ? "hoch" : "niedrig";
    };

    const explain = (label: string, value: number) => {
      if (label === "Kooperationsindex") {
        if (value < 33)
          return "Ihr blockiert die Gegenseite häufig und geht eher selten auf Angebote ein.";
        if (value < 66)
          return "Ihr haltet die Balance zwischen Entgegenkommen und Blockieren.";
        return "Ihr geht meist auf Angebote der Gegenseite ein und spielt deutlich kooperativ.";
      }
      if (label === "Fairnessindex") {
        if (value < 33)
          return "Ihr spielt eure Argumente häufig stärker aus, als sie eigentlich sind.";
        if (value < 66)
          return "Ihr mischt faire und leicht übertriebene Argumente.";
        return "Ihr spielt eure Argumente überwiegend fair und nur selten übertrieben.";
      }
      if (label === "Reaktionssensibilität") {
        if (value < 33)
          return "Euer Verhalten verändert sich kaum, wenn Vertrauen steigt oder sinkt.";
        if (value < 66)
          return "Ihr reagiert teilweise auf Veränderungen im Vertrauen der Gegenseite.";
        return "Ihr reagiert deutlich auf Vertrauensaufbau der Gegenseite und passt euer Verhalten entsprechend an.";
      }
      if (label === "Opportunismusindex") {
        if (value < 33)
          return "Ihr nutzt Vertrauen der Gegenseite kaum für kurzfristige Vorteile aus.";
        if (value < 66)
          return "Ihr nutzt Chancen situativ, ohne durchgehend opportunistisch zu agieren.";
        return "Ihr nutzt hohes Vertrauen der Gegenseite häufig für eigene Vorteile.";
      }
      return "";
    };

    return (
      <div className="border rounded-xl p-4 bg-white shadow mt-4">
        <h3 className="font-semibold mb-2 text-sm">
          Auswertung – {title}
        </h3>

        {[
          {
            label: "Kooperationsindex",
            value: cooperation,
            good: true
          },
          {
            label: "Fairnessindex",
            value: fairness,
            good: true
          },
          {
            label: "Reaktionssensibilität",
            value: sensitivity,
            good: true
          },
          {
            label: "Opportunismusindex",
            value: opportunism,
            good: false
          }
        ].map((item) => (
          <div key={item.label} className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span>{item.label}</span>
              <span>{item.value.toFixed(0)} / 100</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
              <div
                className="h-2 bg-gray-900"
                style={{ width: `${clampPercent(item.value)}%` }}
              />
            </div>
            <div className="text-[11px] text-gray-600 mb-0.5">
              Niveau: {level(item.value, item.good)}
            </div>
            <div className="text-[11px] text-gray-700">
              {explain(item.label, item.value)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <nav className="text-sm mb-4 text-gray-600 flex gap-2">
        <Link to="/">Start</Link>
        <span>/ Host</span>
      </nav>

      <h1 className="text-2xl font-semibold mb-2">
        Host – Runde {round}/{TOTAL_ROUNDS}
      </h1>
      <p className="text-xs text-gray-500 mb-6 font-mono">
        Session: {session}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* TEAM A */}
        <div className="border rounded-xl p-4 bg-white shadow">
          <div className="flex justify-between mb-1">
            <span className="font-semibold">Team A</span>
            <span className="text-sm">
              Score: {teamA.score.toFixed(1)} / Fair:{" "}
              {teamA.fairScore.toFixed(1)}
            </span>
          </div>

          <div className="text-[11px] mb-1">Score</div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
            <div
              className="h-2 bg-gray-900"
              style={{ width: `${clampPercent(teamA.score)}%` }}
            />
          </div>

          <div className="text-[11px] mb-1">Fair-Score</div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
            <div
              className="h-2 bg-gray-500"
              style={{ width: `${clampPercent(teamA.fairScore)}%` }}
            />
          </div>

          <div className="text-[11px] mb-1">Trust</div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
            <div
              className="h-2 bg-blue-500"
              style={{ width: `${clampPercent(teamA.trust)}%` }}
            />
          </div>
          <div className="text-xs text-gray-600">
            Trust: {teamA.trust.toFixed(0)}
          </div>

          {renderSummaryBox("Team A", summaryA)}
        </div>

        {/* TEAM B */}
        <div className="border rounded-xl p-4 bg-white shadow">
          <div className="flex justify-between mb-1">
            <span className="font-semibold">Team B</span>
            <span className="text-sm">
              Score: {teamB.score.toFixed(1)} / Fair:{" "}
              {teamB.fairScore.toFixed(1)}
            </span>
          </div>

          <div className="text-[11px] mb-1">Score</div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
            <div
              className="h-2 bg-gray-900"
              style={{ width: `${clampPercent(teamB.score)}%` }}
            />
          </div>

          <div className="text-[11px] mb-1">Fair-Score</div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
            <div
              className="h-2 bg-gray-500"
              style={{ width: `${clampPercent(teamB.fairScore)}%` }}
            />
          </div>

          <div className="text-[11px] mb-1">Trust</div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
            <div
              className="h-2 bg-green-500"
              style={{ width: `${clampPercent(teamB.trust)}%` }}
            />
          </div>
          <div className="text-xs text-gray-600">
            Trust: {teamB.trust.toFixed(0)}
          </div>

          {renderSummaryBox("Team B", summaryB)}
        </div>
      </div>

      {/* LOG */}
      <div className="border rounded-xl p-4 bg-white shadow">
        <h2 className="font-semibold mb-2 text-sm">Log</h2>
        {log.length === 0 ? (
          <p className="text-xs text-gray-500">Keine Aktionen bisher.</p>
        ) : (
          <ul className="text-xs space-y-1">
            {log.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={() => {
          resetAllLocal();
          resetSession(session);
        }}
        className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
      >
        Session zurücksetzen
      </button>
    </div>
  );
}