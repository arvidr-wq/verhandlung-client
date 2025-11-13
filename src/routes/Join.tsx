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
  type AnyMsg
} from "../lib/transport";

type Card = {
  id: number;
  strength: number;
  used: boolean;
};

function teamLabel(team: Team) {
  return team === "A" ? "Team A" : "Team B";
}

// 8 Argumente aus den Stärken 1–10 (leicht zufällig gemischt)
function initialHand(): Card[] {
  const strengths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  // einfache Shuffle-Funktion
  for (let i = strengths.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [strengths[i], strengths[j]] = [strengths[j], strengths[i]];
  }
  const picked = strengths.slice(0, 8);
  return picked.map((s, idx) => ({
    id: idx + 1,
    strength: s,
    used: false
  }));
}

export default function Join() {
  const [sp] = useSearchParams();
  const team = (sp.get("r") ?? "A") as Team;
  const session = sp.get("s") ?? "TEST";

  const [round, setRound] = useState(1);

  // Hand mit 8 Argument-Karten
  const [hand, setHand] = useState<Card[]>(() => initialHand());
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);

  // Spielweise
  const [mode, setMode] = useState<Mode>("fair");
  const [argSent, setArgSent] = useState(false);

  // Reveal & Reaktion
  const [reveal, setReveal] = useState<null | "weak" | "medium" | "strong">(null);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [reactionEnabled, setReactionEnabled] = useState(false);

  const [status, setStatus] = useState<string>(
    "Wähle eines deiner Argumente und sende es."
  );

  const selectedCard = hand.find(c => c.id === selectedCardId) ?? null;

  // auf Nachrichten des Hosts hören
  useEffect(() => {
    // Bei Session-Wechsel alles zurücksetzen
    setRound(1);
    setHand(initialHand());
    setSelectedCardId(null);
    setMode("fair");
    setArgSent(false);
    setReveal(null);
    setReaction(null);
    setReactionEnabled(false);
    setStatus("Wähle eines deiner Argumente und sende es.");

    const stop = subscribeHost(session, (m: AnyMsg) => {
      // REVEAL: jetzt darf reagiert werden
      if (m.type === "reveal" && m.to === team) {
        setReveal(m.oppCategory);
        setReactionEnabled(true);
        setStatus("Reveal erhalten – reagiere jetzt auf das Argument der Gegenseite.");
      }

      // NÄCHSTE RUNDE
      if (m.type === "next") {
        setRound(r => r + 1);
        setArgSent(false);
        setReveal(null);
        setReaction(null);
        setReactionEnabled(false);
        setSelectedCardId(null);
        setStatus("Neue Runde: Wähle eines deiner verbleibenden Argumente.");
        // Hand bleibt erhalten, nur „used“-Status steuert, was noch spielbar ist
      }

      // RESET
      if (m.type === "reset") {
        setRound(1);
        setHand(initialHand());
        setSelectedCardId(null);
        setMode("fair");
        setArgSent(false);
        setReveal(null);
        setReaction(null);
        setReactionEnabled(false);
        setStatus("Session zurückgesetzt. Wähle eines deiner Argumente.");
      }
    });

    return () => {
      stop();
    };
  }, [session, team]);

 // Argument senden
const handleSendArgument = () => {
  if (argSent) return;
  if (!selectedCard) {
    setStatus("Bitte zuerst eines deiner Argumente auswählen.");
    return;
  }

  playArgument(session, {
    who: team,
    base: selectedCard.strength,
    mode,
  });

  // Karte als „verbraucht“ markieren
  setHand((h) =>
    h.map((c) =>
      c.id === selectedCard.id ? { ...c, used: true } : c
    )
  );

  setArgSent(true);

  // 🔥 WICHTIG: Reaktion sofort ermöglichen
  setReactionEnabled(true);

  setStatus(
    "Argument gesendet – du kannst gleich auf das Argument der Gegenseite reagieren."
  );
};

  // Reaktion senden
  const handleReaction = (value: Reaction) => {
    if (!reactionEnabled) return;
    setReaction(value);
    reactToOpponent(session, {
      who: team,
      reaction: value
    });
    setReactionEnabled(false);
    setStatus("Reaktion gesendet – warte auf die nächste Runde.");
  };

  const revealText =
    reveal === "weak"
      ? "Das Argument der Gegenseite wirkt eher schwach."
      : reveal === "medium"
      ? "Das Argument der Gegenseite wirkt mittelstark."
      : reveal === "strong"
      ? "Das Argument der Gegenseite wirkt sehr stark."
      : "Noch kein Reveal – warte, bis beide gesendet haben.";

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <nav className="mb-4 text-sm text-gray-500 flex gap-2">
        <Link to="/">Start</Link>
        <span>/</span>
        <span>Join</span>
        <span>/</span>
        <span className="font-semibold">{teamLabel(team)}</span>
      </nav>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold">
          Join · {teamLabel(team)}
        </h1>
        <p className="text-sm text-gray-500">
          Session <span className="font-mono">{session}</span> · Runde {round}/10{" "}
          <Link
            to={`/host?s=${encodeURIComponent(session)}`}
            className="underline"
          >
            · Host öffnen
          </Link>
        </p>
      </header>

      {/* 1) Argument wählen */}
      <section className="border rounded-xl p-4 bg-white shadow-sm mb-4">
        <h2 className="font-semibold mb-3 text-sm">1) Dein Argument wählen</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          {hand.map(card => {
            const isSelected = selectedCardId === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setSelectedCardId(card.id)}
                disabled={argSent || card.used}
                className={[
                  "border rounded-lg px-2 py-2 text-xs text-left",
                  card.used ? "bg-gray-100 text-gray-400" : "bg-white",
                  isSelected && !card.used ? "border-black" : "border-gray-200",
                  argSent ? "cursor-default" : "cursor-pointer"
                ].join(" ")}
              >
                <div className="font-semibold">Argument {card.id}</div>
                <div>Stärke: {card.strength}</div>
                {card.used && <div>(bereits gespielt)</div>}
              </button>
            );
          })}
        </div>

        {/* Spielweise */}
        <div className="flex flex-wrap gap-4 text-sm mb-3">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="mode"
              value="fair"
              checked={mode === "fair"}
              onChange={() => setMode("fair")}
              disabled={argSent}
            />
            fair
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="mode"
              value="leicht"
              checked={mode === "leicht"}
              onChange={() => setMode("leicht")}
              disabled={argSent}
            />
            leicht übertrieben
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="mode"
              value="deutlich"
              checked={mode === "deutlich"}
              onChange={() => setMode("deutlich")}
              disabled={argSent}
            />
            deutlich übertrieben
          </label>
        </div>

        <button
          onClick={handleSendArgument}
          disabled={argSent}
          className="px-4 py-2 rounded bg-black text-white text-sm disabled:bg-gray-300"
        >
          Argument senden
        </button>
      </section>

      {/* 2) Reaktion */}
      <section className="border rounded-xl p-4 bg-white shadow-sm mb-4">
        <h2 className="font-semibold mb-2 text-sm">2) Reaktion auf Gegner</h2>
        <p className="text-xs text-gray-500 mb-3">{revealText}</p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleReaction("annehmen")}
            disabled={!reactionEnabled}
            className="px-3 py-2 text-xs rounded border bg-white disabled:bg-gray-100 disabled:text-gray-400"
          >
            annehmen
          </button>
          <button
            onClick={() => handleReaction("zurückstellen")}
            disabled={!reactionEnabled}
            className="px-3 py-2 text-xs rounded border bg-white disabled:bg-gray-100 disabled:text-gray-400"
          >
            zurückstellen
          </button>
          <button
            onClick={() => handleReaction("ablehnen")}
            disabled={!reactionEnabled}
            className="px-3 py-2 text-xs rounded border bg-white disabled:bg-gray-100 disabled:text-gray-400"
          >
            ablehnen
          </button>
        </div>
      </section>

      {/* Status */}
      <div className="text-xs text-gray-600">{status}</div>
    </div>
  );
}