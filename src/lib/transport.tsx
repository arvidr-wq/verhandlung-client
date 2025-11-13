// src/lib/transport.tsx

export type Team = "A" | "B";
export type Mode = "fair" | "leicht" | "deutlich";
export type Reaction = "annehmen" | "zurückstellen" | "ablehnen";

// Nachrichten, die über BroadcastChannel laufen
export type PlayedMsg = {
  type: "played";
  who: Team;
  base: number;       // Grundstärke 1–10
  mode: Mode;         // fair / leicht / deutlich übertrieben
};

export type ReactMsg = {
  type: "react";
  who: Team;
  reaction: Reaction;
};

export type RevealMsg = {
  type: "reveal";
  to: Team;
  oppCategory: "weak" | "medium" | "strong";
};

export type NextMsg = {
  type: "next";
};

export type ResetMsg = {
  type: "reset";
};

export type AnyMsg = PlayedMsg | ReactMsg | RevealMsg | NextMsg | ResetMsg;

// Hilfsfunktion: Kanal pro Session
function channelFor(session: string) {
  return new BroadcastChannel(`vhg-${session}`);
}

// ---- Funktionen, die Join/Host benutzen ----

// Argument spielen
export function playArgument(session: string, data: Omit<PlayedMsg, "type">) {
  const ch = channelFor(session);
  const msg: PlayedMsg = { type: "played", ...data };
  console.log("[BC send]", session, msg);
  ch.postMessage(msg);
  ch.close();
}

// Reaktion auf Gegner
export function reactToOpponent(
  session: string,
  data: Omit<ReactMsg, "type">
) {
  const ch = channelFor(session);
  const msg: ReactMsg = { type: "react", ...data };
  console.log("[BC send]", session, msg);
  ch.postMessage(msg);
  ch.close();
}

// Reveal an ein Team schicken
export function sendReveal(
  session: string,
  to: Team,
  oppCategory: "weak" | "medium" | "strong"
) {
  const ch = channelFor(session);
  const msg: RevealMsg = { type: "reveal", to, oppCategory };
  console.log("[BC send]", session, msg);
  ch.postMessage(msg);
  ch.close();
}

// Nächste Runde auslösen
export function sendNext(session: string) {
  const ch = channelFor(session);
  const msg: NextMsg = { type: "next" };
  console.log("[BC send]", session, msg);
  ch.postMessage(msg);
  ch.close();
}

// Session zurücksetzen
export function resetSession(session: string) {
  const ch = channelFor(session);
  const msg: ResetMsg = { type: "reset" };
  console.log("[BC send]", session, msg);
  ch.postMessage(msg);
  ch.close();
}

// Auf alle Nachrichten einer Session hören (Host & Join können das verwenden)
export function subscribeHost(
  session: string,
  handler: (msg: AnyMsg) => void
): () => void {
  const ch = channelFor(session);
  const onMessage = (e: MessageEvent) => {
    console.log("[BC recv]", session, e.data);
    handler(e.data as AnyMsg);
  };
  ch.addEventListener("message", onMessage);
  return () => {
    ch.removeEventListener("message", onMessage);
    ch.close();
  };
}