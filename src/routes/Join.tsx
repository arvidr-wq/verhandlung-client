// src/routes/Join.tsx
import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  type Team,
  type Mode,
  type Reaction,
  playArgument,
  reactToOpponent,
  subscribeHost,
  sendTrustInvest,
  type AnyMsg,
  type StateSnapshot
} from "../lib/transport";

type Card = {
  id: number;
  strength: number;
  used: boolean;
};

function initialHand(): Card[] {
  return [
    { id: 1, strength: 1, used: false },
    { id: 2, strength: 3, used: false },
    { id: 3, strength: 5, used: false },
    { id: 4, strength: 6, used: false },
    { id: 5, strength: 7, used: false },
    { id: 6, strength: 8, used: false },
    { id: 7, strength: 9, used: false },
    { id: 8, strength: 10, used: false }
  ];
}

function clampPercent(v: number): number {
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

const INVEST_OPTIONS = [0, 3, 5, 7, 10];

export default function Join() {
  const [sp] = useSearchParams();
  const team = (sp.get("r") ?? "A") as Team;
  const session = sp.get("s") ?? "TEST";

  const [round, setRound] = useState(1);
  const [hand, setHand] = useState<Card[]>(initialHand);

  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const selectedCard = hand.find((c) => c.id === selectedCardId) ?? null;

  const [mode, setMode] = useState<Mode>("fair");
  const [argSent, setArgSent] = useState(false);

  const [reveal, setReveal] = useState<null | "weak" | "medium" | "strong">(null);
  const [reactionEnabled, setReactionEnabled] = useState(false);
  const [status, setStatus] = useState<string>(
    "Wähle ein Argument und sende es."
  );

  const [score, setScore] = useState(0);
  const [fairScore, setFairScore] = useState(0);
  const [trust, setTrust] = useState(50);

  const [selectedInvest, setSelectedInvest] = useState<number>(0);
  const [investSent, setInvestSent] = useState(false);

  const [summary, setSummary] =
    useState<StateSnapshot["summary"] | null>(null);

  const isTrustRound = round === 4 || round === 8;
  const isFinished = summary !== null;

  useEffect(() => {
    const stop = subscribeHost(session, (msg: AnyMsg) => {
      if (msg.type === "reveal" && msg.to === team) {
        setReveal(msg.oppCategory);
        setReactionEnabled(true);
        setStatus("Reveal erhalten – reagiere jetzt.");
      }

      if (msg.type === "next") {
        setRound(msg.round);
        setReveal(null);
        setArgSent(false);
        setSelectedCardId(null);
        setReactionEnabled(false);
        setSelectedInvest(0);
        setInvestSent(false);
        setStatus("Neue Runde – bitte Argument wählen.");
      }

      if (msg.type === "reset") {
        setRound(1);
        setHand(initialHand());
        setArgSent(false);
        setSelectedCardId(null);
        setReveal(null);
        setReactionEnabled(false);
        setSelectedInvest(0);
        setInvestSent(false);
        setSummary(null);
        setStatus("Session zurückgesetzt.");
        setScore(0);
        setFairScore(0);
        setTrust(50);
      }

      if (msg.type === "stateUpdate") {
        const self = team === "A" ? msg.A : msg.B;
        setScore(self.score ?? 0);
        setFairScore(self.fairScore ?? 0);
        setTrust(self.trust ?? 50);
        if (self.summary) {
          setSummary(self.summary);
          setStatus("Spiel beendet – Auswertung verfügbar.");
        }
      }
    });

    return () => stop();
  }, [session, team]);

  const sendArg = () => {
    if (isFinished || isTrustRound) return;
    if (!selectedCard) {
      setStatus("Bitte Karte auswählen.");
      return;
    }
    playArgument(session, {
      who: team,
      base: selectedCard.strength,
      mode
    });
    setHand((h) =>
      h.map((c) =>
        c.id === selectedCard.id ? { ...c, used: true } : c
      )
    );
    setArgSent(true);
    setStatus("Argument gesendet – warte auf Reveal.");
  };

  const react = (r: Reaction) => {
    if (isFinished || isTrustRound) return;
    if (!reactionEnabled) return;
    reactToOpponent(session, {
      who: team,
      reaction: r
    });
    setReactionEnabled(false);
    setStatus("Reaktion gesendet – warte auf nächste Runde.");
  };

  const sendInvestment = () => {
    if (isFinished || !isTrustRound) return;
    if (investSent) return;

    const clean = Math.max(0, Math.min(10, Math.round(selectedInvest)));
    sendTrustInvest(session, team, clean);
    setInvestSent(true);
    setStatus(
      `Investition (${clean}%) gesendet – warte auf nächste Runde.`
    );
  };

  const diff = score - fairScore;
  const scorePercent = clampPercent(score);
  const fairPercent = clampPercent(fairScore);
  const trustPercent = clampPercent(trust);

  // -------------------------------
  // Optik der Argumentkarten
  // -------------------------------
  function cardClasses(card: Card): string {
    let bg = "";
    let border = "border-gray-300";
    let text = "text-gray-900";

    if (card.strength <= 3) {
      // schwach
      bg = "bg-blue-50";
      border = "border-blue-200";
    } else if (card.strength <= 7) {
      // mittel
      bg = "bg-yellow-50";
      border = "border-yellow-200";
    } else {
      // stark
      bg = "bg-red-50";
      border = "border-red-200";
    }

    if (card.used) {
      bg = "bg-gray-100";
      text = "text-gray-400";
      border = "border-gray-200";
    }

    const selected = selectedCardId === card.id ? "ring-2 ring-black" : "";

    // leichte Größenvariation nach Stärke
    const size =
      card.strength >= 9
        ? "py-3"
        : card.strength >= 6
        ? "py-2.5"
        : "py-2";

    return [
      "w-full text-left rounded-lg border px-3",
      size,
      bg,
      border,
      text,
      selected
    ].join(" ");
  }

  const renderSummary = () => {
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
          return "Du blockierst die Gegenseite häufig und gehst eher selten auf Angebote ein.";
        if (value < 66)
          return "Du hältst die Balance zwischen Entgegenkommen und Blockieren.";
        return "Du gehst meist auf Angebote der Gegenseite ein und spielst deutlich kooperativ.";
      }
      if (label === "Fairnessindex") {
        if (value < 33)
          return "Du spielst deine Argumente häufig stärker aus, als sie eigentlich sind.";
        if (value < 66)
          return "Du mischst faire und leicht übertriebene Argumente.";
        return "Du spielst deine Argumente überwiegend fair und nur selten übertrieben.";
      }
      if (label === "Reaktionssensibilität") {
        if (value < 33)
          return "Dein Verhalten verändert sich kaum, wenn Vertrauen steigt oder sinkt.";
        if (value < 66)
          return "Du reagierst teilweise auf Veränderungen im Vertrauen der Gegenseite.";
        return "Du reagierst deutlich auf Vertrauensaufbau der Gegenseite und passt dein Verhalten entsprechend an.";
      }
      if (label === "Opportunismusindex") {
        if (value < 33)
          return "Du nutzt Vertrauen der Gegenseite kaum für kurzfristige Vorteile aus.";
        if (value < 66)
          return "Du nutzt Chancen situativ, ohne durchgehend opportunistisch zu agieren.";
        return "Du nutzt hohes Vertrauen der Gegenseite häufig für eigene Vorteile.";
      }
      return "";
    };

    const items = [
      { label: "Kooperationsindex", value: cooperation, good: true },
      { label: "Fairnessindex", value: fairness, good: true },
      { label: "Reaktionssensibilität", value: sensitivity, good: true },
      { label: "Opportunismusindex", value: opportunism, good: false }
    ];

    return (
      <section className="border rounded-xl p-4 bg-white shadow mt-6">
        <h2 className="font-semibold mb-2 text-sm">
          Auswertung deines Spielstils
        </h2>
        <p className="text-xs text-gray-600 mb-3">
          Alle Werte liegen zwischen 0 und 100. 50 ist der neutrale Bereich.
          Höhere Werte bedeuten mehr von der jeweiligen Eigenschaft
          (beim Opportunismus eher vorsichtig interpretieren).
        </p>

        {items.map((item) => (
          <div key={item.label} className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span>{item.label}</span>
              <span>{item.value.toFixed(0)} / 100</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
              <div
                className="h-2"
                style={{
                  width: `${clampPercent(item.value)}%`,
                  background: "#000"
                }}
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

        <p className="text-xs text-gray-700 mt-3">
          Nutzt diese Auswertung im Plenum: Wo habt ihr Vertrauen aufgebaut,
          wo eher gepokert, wo liegen Chancen, euch kooperativer oder
          strategischer aufzustellen?
        </p>
      </section>
    );
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <nav className="mb-4 text-sm text-gray-500">
        <Link to="/">Start</Link> / Join ({team})
      </nav>

      <h1 className="text-xl font-semibold mb-4">
        Runde {round} / 10 – Team {team}
      </h1>

      {/* eigene Kennzahlen */}
      <div className="border rounded-xl p-4 bg-white shadow mb-6">
        <div className="text-sm font-semibold mb-1">
          Team {team} – eigene Werte
        </div>

        <div className="text-[11px] mb-1">Score</div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
          <div
            className="h-2"
            style={{ width: `${scorePercent}%`, background: "#000" }}
          />
        </div>
        <div className="text-xs mb-2">Score: {score.toFixed(1)}</div>

        <div className="text-[11px] mb-1">Fair-Score</div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
          <div
            className="h-2"
            style={{ width: `${fairPercent}%`, background: "#555" }}
          />
        </div>
        <div className="text-xs mb-2">
          Fair-Score (wenn beide fair gespielt hätten):{" "}
          {fairScore.toFixed(1)}
        </div>

        <div className="text-xs mb-3">
          Δ (aktuell − fair): {diff.toFixed(1)}
        </div>

        <div className="text-[11px] mb-1">Trust</div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
          <div
            className="h-2"
            style={{ width: `${trustPercent}%`, background: "#2563eb" }}
          />
        </div>
        <div className="text-xs text-gray-500">
          Trust: {trust.toFixed(0)}
        </div>
      </div>

      {isFinished ? (
        renderSummary()
      ) : isTrustRound ? (
        <section className="border rounded-xl p-4 bg-white shadow mb-6">
          <h2 className="font-semibold mb-2 text-sm">
            Trust-Runde – Investition in Vertrauen
          </h2>
          <p className="text-xs text-gray-600 mb-3">
            In dieser Runde spielst du kein Argument. Du kannst einen
            Prozentsatz deines Scores investieren, damit die Gegenseite
            mehr Vertrauen in dich gewinnt.
          </p>

          <div className="flex flex-wrap gap-2 mb-3 text-sm">
            {INVEST_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                disabled={investSent}
                onClick={() => setSelectedInvest(opt)}
                className={[
                  "px-3 py-1 border rounded text-xs",
                  selectedInvest === opt
                    ? "border-black"
                    : "border-gray-300",
                  investSent ? "bg-gray-200 text-gray-400" : "bg-white"
                ].join(" ")}
              >
                {opt}%
              </button>
            ))}
          </div>

          <button
            onClick={sendInvestment}
            disabled={investSent}
            className="px-4 py-2 text-sm bg-black text-white rounded disabled:bg-gray-300"
          >
            Investition senden
          </button>
        </section>
      ) : (
        <>
          {/* Argument wählen */}
          <section className="border rounded-xl p-4 bg-white shadow mb-6">
            <h2 className="font-semibold mb-2 text-sm">
              1) Argument wählen
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              {hand.map((card) => (
                <button
                  key={card.id}
                  disabled={card.used || argSent}
                  onClick={() => setSelectedCardId(card.id)}
                  className={cardClasses(card)}
                >
                  <div className="text-[11px] font-medium">
                    Argument {card.id}
                  </div>
                  <div className="text-xs">
                    Stärke {card.strength}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-4 text-sm mb-3">
              <label>
                <input
                  type="radio"
                  checked={mode === "fair"}
                  onChange={() => setMode("fair")}
                  disabled={argSent}
                />{" "}
                fair / offen
              </label>
              <label>
                <input
                  type="radio"
                  checked={mode === "leicht"}
                  onChange={() => setMode("leicht")}
                  disabled={argSent}
                />{" "}
                leicht überzogen
              </label>
              <label>
                <input
                  type="radio"
                  checked={mode === "deutlich"}
                  onChange={() => setMode("deutlich")}
                  disabled={argSent}
                />{" "}
                stark überzogen
              </label>
            </div>

            <button
              onClick={sendArg}
              disabled={argSent}
              className="px-4 py-2 text-sm bg-black text-white rounded disabled:bg-gray-300"
            >
              Argument senden
            </button>
          </section>

          {/* Reaktion */}
          <section className="border rounded-xl p-4 bg-white shadow">
            <h2 className="font-semibold mb-2 text-sm">
              2) Reaktion auf Gegner
            </h2>

            <p className="text-xs text-gray-600 mb-2">
              {reveal === null
                ? "Warte auf Reveal..."
                : reveal === "weak"
                ? "Gegnerisches Argument wirkt schwach."
                : reveal === "medium"
                ? "Gegnerisches Argument wirkt mittel."
                : "Gegnerisches Argument wirkt STARK."}
            </p>

            <div className="flex gap-2">
              <button
                disabled={!reactionEnabled}
                onClick={() => react("annehmen")}
                className="px-3 py-1 text-xs border rounded bg-white disabled:text-gray-400"
              >
                annehmen
              </button>
              <button
                disabled={!reactionEnabled}
                onClick={() => react("zurückstellen")}
                className="px-3 py-1 text-xs border rounded bg-white disabled:text-gray-400"
              >
                zurückstellen
              </button>
              <button
                disabled={!reactionEnabled}
                onClick={() => react("ablehnen")}
                className="px-3 py-1 text-xs border rounded bg-white disabled:text-gray-400"
              >
                ablehnen
              </button>
            </div>
          </section>
        </>
      )}

      <div className="text-xs text-gray-600 mt-4">{status}</div>
    </div>
  );
}