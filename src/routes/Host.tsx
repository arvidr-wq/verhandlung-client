// src/routes/Host.tsx
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  subscribeHost,
  sendReveal,
  sendNext,
  resetSession,
  type AnyMsg,
  type Team,
} from "../lib/transport";

// TEAM-ZUSTAND
type TeamState = {
  score: number;
  trust: number;
};

// INTERNE STEUERUNG
type InternalState = {
  played: Partial<Record<Team, { base: number; mode: string }>>;
  reacted: Partial<Record<Team, string>>;
  round: number;
  totalRounds: number;
};

function initialTeam(): TeamState {
  return { score: 0, trust: 50 };
}

function initialInternal(): InternalState {
  return {
    played: {},
    reacted: {},
    round: 1,
    totalRounds: 10,
  };
}

// Berechnung der effektiven Argumentstärke
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

// Punkteberechnung nach dem Gefangenen-Dilemma-Mechanismus
function applyRound(state: InternalState, A: TeamState, B: TeamState) {
  const pA = state.played["A"];
  const pB = state.played["B"];
  const rA = state.reacted["A"];
  const rB = state.reacted["B"];

  if (!pA || !pB || !rA || !rB) return;

  const effA = effectiveStrength(pA.base, pA.mode);
  const effB = effectiveStrength(pB.base, pB.mode);

  function delta(reaction: string, eff: number) {
    if (reaction === "annehmen") return { score: eff, trust: +5 };
    if (reaction === "zurückstellen") return { score: eff * 0.3, trust: -2 };
    // ablehnen
    return { score: -eff * 0.5, trust: -8 };
  }

  const dA = delta(rB, effA); // B reagiert auf A
  const dB = delta(rA, effB); // A reagiert auf B

  A.score += dA.score;
  B.score += dB.score;

  A.trust = Math.max(0, Math.min(100, A.trust + dA.trust));
  B.trust = Math.max(0, Math.min(100, B.trust + dB.trust));
}

// ---------------------------------------------
// HOST-KOMPONENTE
// ---------------------------------------------
export default function Host() {
  const [sp] = useSearchParams();
  const session = sp.get("s") ?? "TEST";

  const [teamA, setTeamA] = useState<TeamState>(initialTeam);
  const [teamB, setTeamB] = useState<TeamState>(initialTeam);
  const [round, setRound] = useState(1);
  const [log, setLog] = useState<string[]>([]);

  const internal = useRef<InternalState>(initialInternal());
  // zusätzlicher Ref, damit wir bei der Auswertung immer die aktuellen Teamwerte haben
  const teamsRef = useRef<{ A: TeamState; B: TeamState }>({
    A: initialTeam(),
    B: initialTeam(),
  });

  useEffect(() => {
    // bei Session-Wechsel alles zurücksetzen
    internal.current = initialInternal();
    const A0 = initialTeam();
    const B0 = initialTeam();
    teamsRef.current = { A: A0, B: B0 };

    setTeamA(A0);
    setTeamB(B0);
    setRound(1);
    setLog([]);

    const stop = subscribeHost(session, (msg: AnyMsg) => {
      const S = internal.current;

      // Team spielt
      if (msg.type === "played") {
        S.played[msg.who] = { base: msg.base, mode: msg.mode };

        setLog((l) => [
          `Team ${msg.who} spielt Stärke ${msg.base} (${msg.mode})`,
          ...l,
        ]);

        // wenn beide gespielt haben → Reveal senden
        if (S.played["A"] && S.played["B"]) {
          const cA = categoryOf(
            effectiveStrength(S.played["B"]!.base, S.played["B"]!.mode)
          );
          const cB = categoryOf(
            effectiveStrength(S.played["A"]!.base, S.played["A"]!.mode)
          );

          sendReveal(session, "A", cA);
          sendReveal(session, "B", cB);

          setLog((l) => [`Reveal gesendet`, ...l]);
        }
      }

      // Team reagiert
      if (msg.type === "react") {
        S.reacted[msg.who] = msg.reaction;

        setLog((l) => [`Team ${msg.who} reagiert: ${msg.reaction}`, ...l]);

        // wenn beide reagiert haben → Runde auswerten und weiterschalten
        if (S.reacted["A"] && S.reacted["B"] && S.played["A"] && S.played["B"]) {
          // Kopie der aktuellen Teamwerte aus dem Ref
          const Acur = { ...teamsRef.current.A };
          const Bcur = { ...teamsRef.current.B };

          applyRound(S, Acur, Bcur);

          // Ref aktualisieren
          teamsRef.current = { A: Acur, B: Bcur };

          // React-State aktualisieren
          setTeamA(Acur);
          setTeamB(Bcur);

          // nächste Runde
          S.round++;
          setRound(S.round);

          // Rundendaten leeren
          S.played = {};
          S.reacted = {};

          // Join-Clients in die nächste Runde schicken
          sendNext(session);
          setLog((l) => [`Runde ${S.round - 1} ausgewertet`, ...l]);
        }
      }

      // Reset
      if (msg.type === "reset") {
        internal.current = initialInternal();
        const A0 = initialTeam();
        const B0 = initialTeam();
        teamsRef.current = { A: A0, B: B0 };

        setTeamA(A0);
        setTeamB(B0);
        setRound(1);
        setLog(["Session zurückgesetzt"]);
      }
    });

    return () => {
      stop();
    };
  }, [session]); // WICHTIG: nur von session abhängig, NICHT von teamA/teamB

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <nav className="text-sm mb-4 text-gray-600 flex gap-2">
        <Link to="/">Start</Link>
        <span>/ Host</span>
      </nav>

      <h1 className="text-2xl font-semibold mb-2">Host – Runde {round}/10</h1>
      <p className="text-xs text-gray-500 mb-6 font-mono">Session: {session}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* TEAM A */}
        <div className="border rounded-xl p-4 bg-white shadow">
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Team A</span>
            <span className="text-sm">Score: {teamA.score.toFixed(1)}</span>
          </div>
          <div className="text-xs mb-1">Trust</div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
            <div
              className="h-2 bg-blue-500"
              style={{ width: `${teamA.trust}%` }}
            />
          </div>
          <div className="text-xs text-gray-600">Trust: {teamA.trust}</div>
        </div>

        {/* TEAM B */}
        <div className="border rounded-xl p-4 bg-white shadow">
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Team B</span>
            <span className="text-sm">Score: {teamB.score.toFixed(1)}</span>
          </div>
          <div className="text-xs mb-1">Trust</div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
            <div
              className="h-2 bg-green-500"
              style={{ width: `${teamB.trust}%` }}
            />
          </div>
          <div className="text-xs text-gray-600">Trust: {teamB.trust}</div>
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
        onClick={() => resetSession(session)}
        className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
      >
        Session zurücksetzen
      </button>
    </div>
  );
}